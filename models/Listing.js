const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    expirationDate: {
        type: Date,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    images: [String],
    status: {
        type: String,
        enum: ['available', 'claimed', 'expired'],
        default: 'available'
    },
    donationDetails: {
        donor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Donor'
        },
        donorName: String,
        donorEmail: String,
        donorPhone: String,
        listingTitle: String,
        date: Date,
        notes: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Listing', listingSchema);
