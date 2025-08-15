// config/settings.js
//basically setting up the parameters

export const POLL_INTERVAL_MS =  20 * 1000; // 1 minutes
export const CONFIDENCE_THRESHOLD = 0.8;
export const CATEGORIES = ["Billing","Technical","Account","Shipping","Sales","Other"];
export const SIMPLE_AUTO_REPLY_CATEGORIES = new Set(["Account","Billing","Shipping"]); // not auto-sent in v1
