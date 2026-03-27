import { useEffect, useState } from "react";
import { getLocation } from "../utils/getLocation";

// These should ideally come from an API or env, but let's match the server's default
const OFFICE_LAT = 17.498200406402017
const OFFICE_LNG = 78.40693989234757;
const MAX_DISTANCE = 200; // meters

const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters

    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

export const useAttendanceValidation = () => {
    const [status, setStatus] = useState("checking");
    const [message, setMessage] = useState("Checking location...");

    useEffect(() => {
        const check = async () => {
            try {
                const location = await getLocation();

                const distance = getDistance(
                    location.lat,
                    location.lng,
                    OFFICE_LAT,
                    OFFICE_LNG
                );

                if (distance > MAX_DISTANCE) {
                    setStatus("error");
                    const distKm = (distance / 1000).toFixed(2);
                    setMessage(`You are outside office location ❌ (${Math.round(distance)}m away)`);
                } else {
                    setStatus("success");
                    setMessage("You are inside office location ✅");
                }
            } catch (err) {
                setStatus("error");
                setMessage(err || "Location access denied ❌");
            }
        };

        check();
    }, []);

    return { status, message };
};