const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Question = require('../src/models/Question');

async function testQuery() {
  const mongoUri = process.env.MONGODB_URL || process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);

  const matchQuestion = await Question.findOne({ questionText: { $regex: '\\\\begin\\{array\\}' } });
  
  if (matchQuestion) {
    console.log("=== DB Sample Formatted Match Question ===");
    console.log("ID:", matchQuestion._id);
    console.log("Subject:", matchQuestion.subject);
    console.log("Question Text:\n", matchQuestion.questionText);
    console.log("\nOptions:", matchQuestion.options);
    console.log("Correct Option:", matchQuestion.correctOption);
  } else {
    console.log("No formatted question found with \\begin{array}");
  }

  process.exit(0);
}

testQuery();
