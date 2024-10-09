import { Client, Environment, ApiError } from "square";

// Set up Square API client
const environment = process.env.NODE_ENV === 'production'
    ? Environment.Production
    : Environment.Sandbox;

const client = new Client({
    environment,
    accessToken: process.env.SQUARE_ACCESS_TOKEN
});

const { loyaltyApi, ordersApi, customersApi } = client;

import ProcessedInfo from "../models/processedInfo.js";
import { successLogColors, warnLogColors, errorLogColors } from "../utils/logColors.js";


const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isEmpty(obj) {
    return !Object.keys(obj).length;
}

const createMissingLoyaltyAccount = async (customer) => {
    try {
        const loyaltyProgramResponse = await loyaltyApi.retrieveLoyaltyProgram('main');
        const loyaltyProgram = loyaltyProgramResponse.result.program;
        console.log("Loyalty program found:", loyaltyProgram);
        const { result: newLoyaltyAccountResponse } = await loyaltyApi.createLoyaltyAccount({
            loyaltyAccount: {
                programId: loyaltyProgram.id,
                mapping: {
                    phoneNumber: customer.phoneNumber
                }
            },
            idempotencyKey: crypto.randomUUID()
        });
        console.log("Successfully created Loyalty Account for customer:", customer.id)
        return newLoyaltyAccountResponse.loyaltyAccount;

    } catch (error) {
        console.error("Error in createMissingLoyaltyAccount:", error);
        return error;
    }
}

const addLoyaltyPoints = async (payment, transactionInfo) => {
    console.log("Entering addLoyaltyPoints");
    try {
        if (!payment.customer_id) {
            transactionInfo.result = {
                status: "FAILED",
                reason: "No Customer ID"
            };
            await transactionInfo.save();
            console.warn("No customer ID attached to payment");
            return;
        }

        console.log("Attempting to find customer with ID", payment.customer_id);
        const customerResponse = await customersApi.retrieveCustomer(payment.customer_id);
        console.log("customerResponse", customerResponse);
        const customer = customerResponse.result.customer;
        console.log(customer);

        if (customer && customer.givenName) transactionInfo.given_name = customer.givenName;
        if (customer && customer.familyName) transactionInfo.family_name = customer.familyName;

        console.log("Attempting to find loyalty account for customer ID", customer.id);
        const loyaltyAccountResponse = await loyaltyApi.searchLoyaltyAccounts({
            query: {
                customerIds: [customer.id]
            }
        });
        console.log("loyaltyAccountResponse:", loyaltyAccountResponse)
        let loyaltyAccount;

        if (loyaltyAccountResponse.result.loyaltyAccounts && loyaltyAccountResponse.result.loyaltyAccounts.length) {
            loyaltyAccount = loyaltyAccountResponse.result.loyaltyAccounts[0];
            console.log("Found loyalty account:", loyaltyAccount);
        } else {
            console.log("No loyalty account found. Creating account for", customer)
            loyaltyAccount = await createMissingLoyaltyAccount(customer);
        }
        console.log("loyaltyAccount:", loyaltyAccount)

        const updatedLoyaltyAccountResponse = await loyaltyApi.accumulateLoyaltyPoints(loyaltyAccount.id, {
            accumulatePoints: {
                orderId: payment.order_id
            },
            locationId: payment.location_id,
            idempotencyKey: crypto.randomUUID()
        });
        console.log("updatedLoyaltyAccountResponse:", updatedLoyaltyAccountResponse);

        // Given that above, loyaltyAccount is assigned from loyaltyAccountResponse.result, even though the log of loyaltyAccountResponse doesn't have that, just the array of loyaltyAccounts, I would initially think I'd have to assign this the same way, but I think this destructuring should work based on what loyaltyAccountResponse actually looks like
        const { loyaltyAccount: updatedLoyaltyAccount } = await loyaltyApi.retrieveLoyaltyAccount(loyaltyAccount.id);

        transactionInfo.loyalty_account = {
            id: loyaltyAccount.id,
            balance: updatedLoyaltyAccount.balance,
            lifetime_points: updatedLoyaltyAccount.lifetimePoints,
            created_at: loyaltyAccount.createdAt,
            updated_at: updatedLoyaltyAccount.updatedAt
        };

        transactionInfo.result = {
            status: "COMPLETED",
            reason: "Points Successfully Added"
        };

        await transactionInfo.save();
        console.log(`Successfully added points to ${customer.givenName} ${customer.familyName} for transaction ${payment.order_id}`);
        return;

    } catch (error) {
        console.error("Error in addLoyaltyPoints:", error);

        if (error instanceof ApiError) {
            error.result.errors.forEach(e => {
                console.error(e.category, e.code, e.detail);
            });
        }

        transactionInfo.result = {
            status: "FAILED",
            reason: error
        };

        await transactionInfo.save();
        return;
    }
};

const updatedPaymentRequestHandler = async (req, res, next) => {
    console.log("Received payment update notification");

    try {
        if (!req.body || !req.body.data || !req.body.data.object) {
            console.warn("The request does not have payment data. Try again.");
            return;
        }

        const { payment } = req.body.data.object;
        console.log("Payment detected: ", payment.id);

        let transactionInfo = new ProcessedInfo({
            payment: {
                id: payment.id,
                status: payment.status,
                location_id: payment.location_id,
                order_id: payment.order_id
            }
        });

        if (payment.status !== "COMPLETED") {
            transactionInfo.result = {
                status: "FAILED",
                reason: "Transaction Not Yet Completed"
            };
            await transactionInfo.save();
            console.warn("The transaction has not yet been completed. It will be skipped.");
            return;
        }

        console.log("Finding the corresponding order: ", payment.order_id);
        try {
            const orderDetails = await ordersApi.retrieveOrder(payment.order_id);

            if (!orderDetails || !orderDetails.result.order) {
                transactionInfo.result = {
                    status: "FAILED",
                    reason: "No order found"
                };
                await transactionInfo.save();
                console.error("No order found ", payment.order_id);
                return;
            }

            console.log("Found order:", orderDetails.result.order);

            if (orderDetails.result.order.tenders[0].type === "CASH") {
                transactionInfo.result = {
                    status: "FAILED",
                    reason: "Not From Acuity"
                };
                await transactionInfo.save();
                console.warn("This order was cash, not possible to be from Acuity. It will be skipped.");
                return;
            }

            if (orderDetails.result.order.source.name === "Acuity Scheduling") {
                console.log("This order came from Acuity. Attempting to add loyalty points");
                await addLoyaltyPoints(payment, transactionInfo);
                console.log(successLogColors, "Loyalty points processed");
                return;
            } else {
                transactionInfo.result = {
                    status: "FAILED",
                    reason: "Not From Acuity"
                };
                await transactionInfo.save();
                console.warn("The transaction is not from Acuity Scheduling. It will be skipped.");
                return;
            }
        } catch (error) {
            transactionInfo.result = {
                status: "FAILED",
                reason: error.message
            };
            await transactionInfo.save();
            console.error("Error retrieving order:", error);
            return;
        }
    } catch (error) {
        console.error("Unexpected error in payment request handler:", error);
        return;
    }
};

const getLocations = async () => {
    console.log("Getting Location ID");
    try {
        let listLocationsResponse = await locationsApi.listLocations();
        let locations = listLocationsResponse.result.locations;
        console.log(`Got location ID of ${locations[0].id}`)
        return locations[0].id;
    } catch (error) {
        if (error instanceof ApiError) {
            error.result.errors.forEach(function (e) {
                console.log(e.category);
                console.log(e.code);
                console.log(e.detail);
            });
        } else {
            console.log("Unexpected error occurred: ", error);
        }
    }
};

const listLoyaltyAccounts = async () => {
    console.log("Retrieving all Loyalty Accounts");
    const limit = 200;
    let customerArray = []
    try {
        let listLoyaltyResponse = await loyaltyApi.searchLoyaltyAccounts({ limit: limit });

        while (!isEmpty(listLoyaltyResponse.result)) {
            let customers = listLoyaltyResponse.result.loyaltyAccounts;
            customerArray.push(...customers);

            let cursor = listLoyaltyResponse.result.cursor;
            if (cursor) {
                listLoyaltyResponse = await loyaltyApi.searchLoyaltyAccounts({
                    cursor: cursor,
                    limit: limit
                });
            } else {
                break;
            }
        }
        console.log(`Retrieved ${customerArray.length} loyalty accounts`)
        return customerArray;

    } catch (error) {
        if (error instanceof ApiError) {
            error.result.errors.forEach(function (e) {
                console.log(e.category);
                console.log(e.code);
                console.log(e.detail);
            });
        } else {
            console.log("Unexpected error occurred: ", error);
        }
    }
};

const accumulateLoyaltyDollars = async (customer, locationId) => {
    try {
        let totalLoyaltyDollars = 0;
        const limit = 5
        let listOrdersResponse = await ordersApi.searchOrders({
            locationIds: [locationId],
            limit: limit,
            query: {
                filter: {
                    customerFilter: {
                        customerIds: [customer.customerId]
                    },
                    dateTimeFilter: {
                        startAt: customer.enrolledAt
                    }
                }
            }
        });

        while (!isEmpty(listOrdersResponse.result)) {
            let orders = listOrdersResponse.result.orders;
            // We'll need an orders.reduce function to accumulate the total number of dollars spent on these orders, then we'll compare that to customer.lifetimePoints
            const loyaltyDollarsAccumulator = orders.reduce((total, order) => {
                // Have to parseInt because amounts are stored as number of cents with "n" at the end for some reason
                return total + parseInt(order.totalMoney.amount);
            }, 0);
            totalLoyaltyDollars += Math.floor(loyaltyDollarsAccumulator / 100);

            let cursor = listOrdersResponse.result.cursor;
            if (cursor) {
                listOrdersResponse = await ordersApi.searchOrders({
                    locationIds: [locationId],
                    limit: limit,
                    cursor: cursor,
                    query: {
                        filter: {
                            customerFilter: {
                                customerIds: [customer.customerId]
                            },
                            dateTimeFilter: {
                                startAt: customer.enrolledAt
                            }
                        }
                    }
                });
            } else {
                break;
            }
        }
        // console.log(`${customer.customerId} total loyalty dollars: ${totalLoyaltyDollars}`)
        // Return total loyalty dollars for this customer
        return totalLoyaltyDollars;
    } catch (error) {
        if (error instanceof ApiError) {
            error.result.errors.forEach(function (e) {
                console.log(e.category);
                console.log(e.code);
                console.log(e.detail);
            });
        } else {
            console.log("Unexpected error occurred: ", error);
        }
    }
};

const compareAndUpdateLoyaltyAmounts = async (customer, loyaltyTotal) => {
    try {
        if (loyaltyTotal > customer.lifetimePoints) {
            const difference = loyaltyTotal - customer.lifetimePoints;
            console.log(`Customer ${customer.id} is missing ${loyaltyTotal - customer.lifetimePoints} Loyalty Points`);
            await loyaltyApi.adjustLoyaltyPoints(customer.id, { idempotencyKey: randomUUID(), adjustPoints: { loyaltyProgramId: customer.programId, points: difference, reason: "Acuity Scheduling Points" } });

            console.log(successLogColors, "Added", difference, "to customer", customer.id);
        } else {
            console.log(customer.id, "Has the correct number of points");
            return;
        }
        console.log("Points Updated Successfully");
        return;
    } catch (error) {
        if (error instanceof ApiError) {
            error.result.errors.forEach(function (e) {
                console.log(e.category);
                console.log(e.code);
                console.log(e.detail);
            });
        } else {
            console.log("Unexpected error occurred: ", error);
        }
    }
};

const correctLoyaltyPoints = async () => {
    try {
        const myLocation = await getLocations();
        const loyaltyEnrollees = await listLoyaltyAccounts();
        for (let customer of loyaltyEnrollees) {
            const loyaltyTotal = await accumulateLoyaltyDollars(customer, myLocation);
            await compareAndUpdateLoyaltyAmounts(customer, loyaltyTotal);
            await delay(100);  // Delay after each customer
        };
    } catch (error) {
        if (error instanceof ApiError) {
            error.result.errors.forEach(function (e) {
                console.log(e.category);
                console.log(e.code);
                console.log(e.detail);
            });
        } else {
            console.log("Unexpected error occurred: ", error);
        }
    }
};

const onDemandDisplay = async (req, res, next) => {
    try {
        const loyaltyAccountsList = await listLoyaltyAccounts();
        const expectedTime = Math.round(loyaltyAccountsList.length / 30);
        const startTime = new Date(Date.now()).toLocaleTimeString("en-US");
        const finishTime = new Date(Date.now() + expectedTime * 60 * 1000).toLocaleTimeString("en-US");
        res.send(`<div style="margin-left: 20%; margin-top: 3em"><h1>Loyalty Points Update Started</h1> <h2>${loyaltyAccountsList.length} Loyalty Accounts To Process</h2><p>This page will not update after loyalty points have been processed.</p><p>Accounts take about 2 seconds each to process, so please allow at least ${expectedTime} minutes</p><p>Started: ${startTime}. Expected Completion: ${finishTime}.</p></div>`);
        await correctLoyaltyPoints();
    } catch (err) {
        console.log(err);
        res.send("There was an issue updating loyalty account point amounts. Please refresh the page to try again. If the issue persists, contact robertgreenstreet@gmail.com");
    }
}

export { updatedPaymentRequestHandler, onDemandDisplay }