const { generateWithRetry } = require("./gemini-helper");
const fs = require("fs");
const path = require("path");

const topicQuestionsFile = path.join(
    __dirname,
    "data",
    "topic-questions.json"
);


// ========================================
// NORMALIZE TEXT
// ========================================

function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}


// ========================================
// LOAD FALLBACK QUESTIONS
// ========================================

function loadFallbackQuestions(
    topic,
    company,
    role
) {

    try {

        if (!fs.existsSync(topicQuestionsFile)) {
            return [];
        }

        const data =
            fs.readFileSync(
                topicQuestionsFile,
                "utf8"
            );

        if (!data.trim()) {
            return [];
        }

        const database =
            JSON.parse(data);

        const allQuestions = [];


        // --------------------------------
        // Recursively find question objects
        // --------------------------------

        function collectQuestions(value) {

            if (Array.isArray(value)) {

                value.forEach(item => {
                    collectQuestions(item);
                });

                return;
            }


            if (
                value &&
                typeof value === "object"
            ) {

                if (
                    value.question &&
                    value.answer
                ) {

                    allQuestions.push(value);
                }


                Object.values(value).forEach(
                    item => {
                        if (
                            item &&
                            typeof item === "object"
                        ) {
                            collectQuestions(item);
                        }
                    }
                );
            }
        }


        collectQuestions(database);


        const topicName =
            normalize(topic);

        const companyName =
            normalize(company);

        const roleName =
            normalize(role);


        // --------------------------------
        // Match topic first
        // --------------------------------

        let matched =
            allQuestions.filter(item => {

                return normalize(
                    item.topic
                ) === topicName;

            });


        // --------------------------------
        // Match company if available
        // --------------------------------

        const companyMatched =
            matched.filter(item => {

                const itemCompany =
                    normalize(item.company);

                return (
                    !itemCompany ||
                    !companyName ||
                    itemCompany === companyName
                );

            });


        if (companyMatched.length >= 5) {
            matched = companyMatched;
        }


        // --------------------------------
        // Match role if available
        // --------------------------------

        const roleMatched =
            matched.filter(item => {

                const itemRole =
                    normalize(item.role);

                return (
                    !itemRole ||
                    !roleName ||
                    itemRole === roleName
                );

            });


        if (roleMatched.length >= 5) {
            matched = roleMatched;
        }


        // --------------------------------
        // If exact topic match failed,
        // search topic inside question data
        // --------------------------------

        if (matched.length < 5) {

            matched =
                allQuestions.filter(item => {

                    const text =
                        normalize(
                            item.question
                        );

                    return (
                        text.includes(topicName)
                    );

                });

        }


        // --------------------------------
        // Remove duplicate questions
        // --------------------------------

        const unique = [];

        const seen =
            new Set();


        for (const item of matched) {

            const question =
                String(
                    item.question || ""
                ).trim();

            const key =
                normalize(question);


            if (
                question &&
                !seen.has(key)
            ) {

                seen.add(key);

                unique.push({

                    question:
                        question,

                    answer:
                        String(
                            item.answer || ""
                        ),

                    explanation:
                        String(
                            item.explanation ||
                            "Review this concept and practice similar placement questions."
                        )

                });

            }


            if (unique.length === 5) {
                break;
            }

        }


        return unique;

    } catch (error) {

        console.log(
            "Fallback question loading error:",
            error.message
        );

        return [];

    }

}


// ========================================
// GENERATE PRACTICE QUESTIONS
// ========================================

async function generatePracticeQuestions(
    topic,
    company = "",
    role = ""
) {

    if (!topic) {
        throw new Error(
            "Topic is required"
        );
    }


    const prompt = `
You are an expert B.Tech CSE placement preparation teacher.

Generate exactly 5 practice questions.

Topic: ${topic}
Company: ${company || "General"}
Role: ${role || "General"}

Requirements:

1. Questions must be directly related to the given topic.
2. Questions should be useful for placement preparation.
3. Use simple and clear language.
4. Include a mixture of easy, medium and difficult questions.
5. Questions can include theory, coding or practical concepts when appropriate.
6. Do not repeat questions.
7. Do not ask unrelated questions.
8. Give a correct answer.
9. Give a short explanation for every answer.
10. Return ONLY valid JSON.

Use exactly this format:

{
  "topic": "${topic}",
  "questions": [
    {
      "question": "Question text",
      "answer": "Correct answer",
      "explanation": "Short explanation"
    }
  ]
}
`;


    try {

        // ========================================
        // TRY GEMINI
        // ========================================

        const response =
            await generateWithRetry({

                model:
                    "gemini-3.5-flash-lite",

                contents:
                    prompt,

                config: {
                    responseMimeType:
                        "application/json"
                }

            });


        let text =
            response.text;


        if (!text) {

            throw new Error(
                "Gemini returned an empty response"
            );

        }


        text =
            text.trim();


        if (
            text.startsWith("```")
        ) {

            text =
                text
                    .replace(
                        /^```json\s*/i,
                        ""
                    )
                    .replace(
                        /^```\s*/i,
                        ""
                    )
                    .replace(
                        /\s*```$/i,
                        ""
                    )
                    .trim();

        }


        const questions =
            JSON.parse(text);


        if (
            !questions.questions ||
            !Array.isArray(
                questions.questions
            )
        ) {

            throw new Error(
                "Invalid practice question format"
            );

        }


        if (
            questions.questions.length !== 5
        ) {

            throw new Error(
                "Gemini did not generate exactly 5 questions"
            );

        }


        return {
            topic: topic,
            questions:
                questions.questions,
            source: "gemini"
        };


    } catch (error) {

        console.log(
            "Gemini practice questions unavailable."
        );

        console.log(
            "Using topic question database..."
        );


        // ========================================
        // FALLBACK TO DATABASE
        // ========================================

        const fallback =
            loadFallbackQuestions(
                topic,
                company,
                role
            );


        if (
            fallback.length >= 5
        ) {

            console.log(
                "Fallback questions loaded:",
                fallback.length
            );


            return {

                topic: topic,

                questions:
                    fallback.slice(0, 5),

                source: "database"

            };

        }


        // ========================================
        // LAST FALLBACK
        // ========================================

        console.log(
            "No database questions found."
        );


        return {

            topic: topic,

            questions: [

                {
                    question:
                        `What is ${topic}?`,

                    answer:
                        `${topic} is an important concept used in computer science and placement preparation.`,

                    explanation:
                        `Study the basic concepts and applications of ${topic}.`
                },

                {
                    question:
                        `Why is ${topic} important?`,

                    answer:
                        `${topic} helps in solving programming and technical problems.`,

                    explanation:
                        `Understanding ${topic} helps candidates answer technical interview questions.`
                },

                {
                    question:
                        `What are the basic concepts of ${topic}?`,

                    answer:
                        `The basic concepts depend on the specific topic.`,

                    explanation:
                        `Review the fundamental concepts of ${topic} before attempting advanced questions.`
                },

                {
                    question:
                        `Where is ${topic} commonly used?`,

                    answer:
                        `${topic} is used in software development and computer science applications.`,

                    explanation:
                        `Learning practical applications makes the topic easier to understand.`
                },

                {
                    question:
                        `How should a student prepare ${topic} for placements?`,

                    answer:
                        `Study concepts and practice placement questions.`,

                    explanation:
                        `Practice both basic and interview-level questions to improve preparation.`
                }

            ],

            source: "fallback"

        };

    }

}


module.exports = {
    generatePracticeQuestions
};