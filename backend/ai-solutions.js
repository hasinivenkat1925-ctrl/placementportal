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

function loadFallbackSolutions(
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

                if (value.question) {
                    allQuestions.push(value);
                }

                Object.values(value).forEach(item => {

                    if (
                        item &&
                        typeof item === "object"
                    ) {
                        collectQuestions(item);
                    }

                });

            }

        }


        collectQuestions(database);


        const topicName =
            normalize(topic);

        const companyName =
            normalize(company);

        const roleName =
            normalize(role);


        // ========================================
        // MATCH TOPIC
        // ========================================

        let matched =
            allQuestions.filter(item => {

                return normalize(
                    item.topic
                ) === topicName;

            });


        // ========================================
        // MATCH COMPANY
        // ========================================

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


        // ========================================
        // MATCH ROLE
        // ========================================

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


        // ========================================
        // TOPIC SEARCH FALLBACK
        // ========================================

        if (matched.length < 5) {

            matched =
                allQuestions.filter(item => {

                    const questionText =
                        normalize(
                            item.question
                        );

                    return questionText.includes(
                        topicName
                    );

                });

        }


        // ========================================
        // REMOVE DUPLICATES
        // ========================================

        const unique = [];
        const seen = new Set();


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

                const answer =
                    String(
                        item.answer ||
                        "Review the basic concepts related to this question."
                    );


                const solution =
                    String(
                        item.explanation ||
                        "Understand the concept, review the answer and practice similar placement questions."
                    );


                unique.push({

                    question:
                        question,

                    answer:
                        answer,

                    solution:
                        solution

                });

            }


            if (unique.length === 5) {
                break;
            }

        }


        return unique;

    } catch (error) {

        console.log(
            "Fallback solution loading error:",
            error.message
        );

        return [];

    }

}


// ========================================
// GENERATE SOLUTIONS
// ========================================

async function generateSolutions(
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

Generate exactly 5 practice questions with their detailed solutions.

Topic: ${topic}
Company: ${company || "General"}
Role: ${role || "General"}

Requirements:

1. Questions must be directly related to the given topic.
2. Questions should be useful for placement preparation.
3. Use simple and clear language.
4. Include a mixture of easy, medium and difficult questions.
5. Include theory, coding or practical questions when appropriate.
6. Give the correct answer for every question.
7. Give a clear step-by-step solution or explanation.
8. Do not repeat questions.
9. Do not ask unrelated questions.
10. Return ONLY valid JSON.

Use exactly this format:

{
  "topic": "${topic}",
  "solutions": [
    {
      "question": "Question text",
      "answer": "Correct answer",
      "solution": "Detailed but easy-to-understand solution"
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
                    "gemini-3.5-flash-light",

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


        const data =
            JSON.parse(text);


        if (
            !data.solutions ||
            !Array.isArray(
                data.solutions
            )
        ) {

            throw new Error(
                "Invalid solution format returned by Gemini"
            );

        }


        if (
            data.solutions.length !== 5
        ) {

            throw new Error(
                "Gemini generated " +
                data.solutions.length +
                " solutions instead of 5"
            );

        }


        return {

            topic: topic,

            solutions:
                data.solutions,

            source: "gemini"

        };


    } catch (error) {

        console.log(
            "Gemini solutions unavailable."
        );

        console.log(
            "Using topic question database..."
        );


        // ========================================
        // FALLBACK TO DATABASE
        // ========================================

        const fallback =
            loadFallbackSolutions(
                topic,
                company,
                role
            );


        if (
            fallback.length >= 5
        ) {

            console.log(
                "Fallback solutions loaded:",
                fallback.length
            );


            return {

                topic: topic,

                solutions:
                    fallback.slice(0, 5),

                source: "database"

            };

        }


        // ========================================
        // LAST FALLBACK
        // ========================================

        console.log(
            "No database solutions found."
        );


        return {

            topic: topic,

            solutions: [

                {
                    question:
                        `What is ${topic}?`,

                    answer:
                        `${topic} is an important concept in computer science.`,

                    solution:
                        `Study the basic definition, concepts and applications of ${topic}.`
                },

                {
                    question:
                        `Why is ${topic} important?`,

                    answer:
                        `${topic} is useful for solving technical and programming problems.`,

                    solution:
                        `Understanding ${topic} helps students answer placement and interview questions.`
                },

                {
                    question:
                        `What are the basic concepts of ${topic}?`,

                    answer:
                        `The basic concepts depend on the specific topic.`,

                    solution:
                        `Start with the fundamental concepts of ${topic} and then move to advanced topics.`
                },

                {
                    question:
                        `Where is ${topic} used?`,

                    answer:
                        `${topic} is used in software development and computer science applications.`,

                    solution:
                        `Learn practical examples of ${topic} to understand where and how it is used.`
                },

                {
                    question:
                        `How should a student prepare ${topic} for placements?`,

                    answer:
                        `Study concepts and practice placement questions.`,

                    solution:
                        `Review the fundamentals, solve practice questions and revise common interview problems related to ${topic}.`
                }

            ],

            source: "fallback"

        };

    }

}


module.exports = {
    generateSolutions
};