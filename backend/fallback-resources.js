const fs = require("fs");
const path = require("path");

const questionsFile = path.join(
    __dirname,
    "data",
    "questions.json"
);

const topicQuestionsFile = path.join(
    __dirname,
    "data",
    "topic-questions.json"
);


// ------------------------------
// Read JSON file safely
// ------------------------------

function readJsonFile(file) {

    try {

        if (!fs.existsSync(file)) {
            return [];
        }

        const data =
            fs.readFileSync(file, "utf8");

        if (!data.trim()) {
            return [];
        }

        return JSON.parse(data);

    } catch (error) {

        console.log(
            "Fallback JSON read error:",
            error.message
        );

        return [];
    }
}


// ------------------------------
// Get all questions
// ------------------------------

function getAllQuestions() {

    return readJsonFile(
        questionsFile
    );
}


// ------------------------------
// Get topic questions
// ------------------------------

function getAllTopicQuestions() {

    return readJsonFile(
        topicQuestionsFile
    );
}


// ------------------------------
// Find questions by company/role
// ------------------------------

function getCompanyQuestions(
    company,
    role
) {

    const questions =
        getAllQuestions();

    const companyText =
        String(company || "")
            .toLowerCase()
            .trim();

    const roleText =
        String(role || "")
            .toLowerCase()
            .trim();

    const matching =
        questions.filter(item => {

            const itemCompany =
                String(
                    item.company || ""
                ).toLowerCase();

            const itemRole =
                String(
                    item.role || ""
                ).toLowerCase();

            return (
                itemCompany === companyText &&
                itemRole === roleText
            );
        });

    return matching.slice(0, 5);
}


// ------------------------------
// Convert questions to solutions
// ------------------------------

function createSolutions(
    questions,
    company,
    role
) {

    return questions
        .slice(0, 5)
        .map(item => {

            const answer =
                item.answer ||
                item.correctAnswer ||
                "Refer to the provided options.";

            return {

                question:
                    item.question || "",

                answer:
                    answer,

                solution:
                    item.explanation ||
                    "Review the concept and practice similar placement questions."
            };
        });
}


// ------------------------------
// Create fallback quiz
// ------------------------------

function createQuiz(
    questions
) {

    return questions
        .slice(0, 5)
        .map(item => ({

            question:
                item.question || "",

            options:
                item.options || [],

            answer:
                item.answer ||
                item.correctAnswer ||
                "",

            explanation:
                item.explanation || ""
        }));
}


// ------------------------------
// Export functions
// ------------------------------

module.exports = {

    getAllQuestions,

    getAllTopicQuestions,

    getCompanyQuestions,

    createSolutions,

    createQuiz

};