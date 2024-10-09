if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
};

const successLogColors = "\x1b[32m";
const warnLogColors = "\x1b[33m";
const errorLogColors = "\x1b[31m";

const mongoose = require('mongoose');
const { Client, Environment, ApiError } = require("square");
const { randomUUID } = require("crypto");

const client = new Client({
    bearerAuthCredentials: {
        accessToken: process.env.SQUARE_ACCESS_TOKEN
    },
    environment: Environment.Production,
});

const { locationsApi, loyaltyApi, ordersApi } = client;

const maxRetries = 5; // Number of attempts
let attempts = 0;

const connectToMongoose = function (delay) {
    const retryFunction = this.connectToMongoose; // Store a reference to the function
    attempts++;
    attempts++;

    mongoose.connect(process.env.DB_CONNECTION_STRING, { dbName: "retroactiveLoyalty" })
        .then(() => {
            console.log(`Mongoose Connected to MongoDB`);
        })
        .catch((err) => {
            console.error(`Failed to connect to MongoDB (attempt ${attempts}): ${err.message}`);

            if (attempts < maxRetries) {
                const nextDelay = delay * 2; // Exponential backoff
                console.log(`Retrying in ${delay / 1000} seconds...`);
                setTimeout(() => retryFunction(nextDelay), delay);
            } else {
                console.error('Max retries reached. Exiting...');
                process.exit(1); // Exit with failure code
            }
        });
}

class ExpressError extends Error {
    constructor(message, statusCode) {
        super();
        this.message = message;
        this.statusCode = statusCode
    }
};

const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isEmpty(obj) {
    return !Object.keys(obj).length;
}

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
}

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
        const startTime = new Date(Date.now()).toLocaleTimeString();
        const finishTime = new Date(Date.now() + expectedTime * 60 * 1000).toLocaleTimeString();
        res.send(`<div style="margin-left: 20%; margin-top: 3em"><h1>Loyalty Points Update Started</h1> <h2>${loyaltyAccountsList.length} Loyalty Accounts To Process</h2><p>This page will not update after loyalty points have been processed.</p><p>Accounts take about 2 seconds each to process, so please allow at least ${expectedTime} minutes</p><p>Started: ${startTime}. Expected Completion: ${finishTime}.</p></div>`);
        await correctLoyaltyPoints();
    } catch (err) {
        console.log(err);
        res.send("There was an issue updating loyalty account point amounts. Please refresh the page to try again. If the issue persists, contact robertgreenstreet@gmail.com");
    }
}

module.exports = {
    connectToMongoose,
    ExpressError,
    correctLoyaltyPoints,
    onDemandDisplay
};