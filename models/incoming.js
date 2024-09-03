import mongoose from "mongoose";
const Schema = mongoose.Schema;

const IncomingSchema = new Schema({
    payment_id: {
        type: String,
        required: true
    },
    received: {
        type: Date,
        required: true,
        default: Date.now()
    }
});

export default mongoose.model("Incoming", IncomingSchema);