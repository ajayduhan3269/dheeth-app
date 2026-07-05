const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Question = require('../src/models/Question');

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URL || process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('No MongoDB URI found in .env');
      process.exit(1);
    }
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to DB...');

    const seedsDir = path.join(__dirname, '..', 'data', 'seeds');
    console.log('Looking for seed files in:', seedsDir);
    const files = fs.readdirSync(seedsDir).filter(file => file.endsWith('.json'));
    console.log('Found files:', files);

    if (files.length === 0) {
      console.log('No seed files found in data/seeds. Exiting.');
      process.exit(0);
    }

    let allQuestions = [];

    for (const file of files) {
      const filePath = path.join(seedsDir, file);
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      const formattedQuestions = fileData.map(q => {
        let baseSubject = q.subject;
        if (file.includes('fluid_mechanics')) baseSubject = 'Fluid Mechanics';
        if (file.includes('highway_engineering')) baseSubject = 'Highway Engineering';
        if (file.includes('soil_mechanics')) baseSubject = 'Soil Mechanics';
        if (file.includes('building_materials')) baseSubject = 'Building Materials';
        if (file.includes('environmental_engineering')) baseSubject = 'Environmental Engineering';
        if (file.includes('irrigation_engineering')) baseSubject = 'Irrigation Engineering';

        let finalTopic = q.topic || 'General';
        if (q.subject && q.subject !== baseSubject) {
          finalTopic = q.subject;
        }

        return {
          subject: baseSubject,
          topic: finalTopic,
          category: 'tech',
          questionNumber: q.question_number || '',
          questionText: q.question_text || q.questionText || 'No question text',
          options: {
            a: q.options?.a || 'N/A',
            b: q.options?.b || 'N/A',
            c: q.options?.c || 'N/A',
            d: q.options?.d || 'N/A'
          },
          correctOption: q.correct_answer || q.correctOption || 'a',
          explanation: q.solution || q.explanation || 'No explanation provided.',
          hasDiagram: q.has_diagram || false,
          diagramUrl: q.diagram_link || null
        };
      });

      allQuestions = allQuestions.concat(formattedQuestions);
      console.log(`Loaded ${fileData.length} questions from ${file}`);
    }

    await Question.deleteMany({});
    console.log('Old questions cleared.');

    if (allQuestions.length > 0) {
      await Question.insertMany(allQuestions);
      console.log(`Successfully seeded a total of ${allQuestions.length} questions across ${files.length} subjects!`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
};

seedDatabase();
