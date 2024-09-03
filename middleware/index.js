import Incoming from "../models/incoming.js";

function asyncWrapper(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch(next)
    }
}
async function quickResponse (req, res, next) {
    const { payment } = req.body.data.object;
    if (payment && payment.id) {
        res.status(202)
        res.send("Request Received");
        await new Incoming({ payment_id: payment.id }).save();
        next();
    } else {
        res.status(400)
        next("No payment ID specified");
    }
}

export { asyncWrapper, quickResponse };