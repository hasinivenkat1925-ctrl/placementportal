const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

async function generateWithRetry(options) {

    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {

        try {

            console.log(
                `Gemini request attempt ${attempt}/3`
            );

            const response =
                await ai.models.generateContent(options);

            console.log(
                "Gemini request successful"
            );

            return response;

        } catch (error) {

            lastError = error;

            const errorText =
                String(error.message || error);

            console.log(
                "Gemini request error:",
                errorText
            );

            // --------------------------------
            // QUOTA EXCEEDED - DO NOT RETRY
            // --------------------------------

            if (
                errorText.includes("429") ||
                errorText.includes("RESOURCE_EXHAUSTED") ||
                errorText.includes("quota") ||
                errorText.includes("Quota exceeded")
            ) {

                console.log(
                    "Gemini quota exceeded. Using fallback content."
                );

                throw new Error(
                    "GEMINI_QUOTA_EXCEEDED"
                );
            }

            // --------------------------------
            // TEMPORARY GEMINI SERVER ERROR
            // --------------------------------

            const temporaryError =
                errorText.includes("503") ||
                errorText.includes("UNAVAILABLE") ||
                errorText.includes("overloaded") ||
                errorText.includes("high demand") ||
                errorText.includes("500") ||
                errorText.includes("502") ||
                errorText.includes("504");

            if (!temporaryError) {
                throw error;
            }

            // --------------------------------
            // RETRY TEMPORARY ERRORS
            // --------------------------------

            if (attempt === 3) {
                break;
            }

            const delay =
                attempt === 1
                    ? 2000
                    : 5000;

            console.log(
                `Retrying Gemini in ${delay / 1000} seconds...`
            );

            await wait(delay);
        }
    }

    throw new Error(
        "GEMINI_TEMPORARILY_UNAVAILABLE"
    );
}

module.exports = {
    generateWithRetry
};