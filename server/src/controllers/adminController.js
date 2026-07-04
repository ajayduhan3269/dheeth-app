const Question = require('../models/Question');

/**
 * Transforms a raw seed-format question into the DB schema format.
 * Handles both the seed file format (snake_case) and the DB format (camelCase).
 *
 * Question text is expected to be pre-formatted with $...$ (or $$...$$) delimiters
 * for LaTeX. We store it verbatim — no runtime rewriting — so what the uploader
 * sends is what renders. Malformed input (raw backslashes without $) will simply
 * not render as math; correctness is the uploader's responsibility.
 */
function transformQuestion(q, fallbackSubject) {
  const subject = q.subject || fallbackSubject || 'Unknown';

  return {
    subject,
    topic: q.topic || 'General',
    category: q.category || 'tech',
    questionNumber: q.question_number || q.questionNumber || '',
    questionText: q.question_text || q.questionText || 'No question text',
    options: {
      a: q.options?.a || 'N/A',
      b: q.options?.b || 'N/A',
      c: q.options?.c || 'N/A',
      d: q.options?.d || 'N/A',
    },
    correctOption: q.correct_answer || q.correctOption || 'a',
    explanation: q.solution || q.explanation || 'No explanation provided.',
    hasDiagram: q.has_diagram || q.hasDiagram || false,
    diagramUrl: q.diagram_link || q.diagramUrl || null,
  };
}

/**
 * Handles bulk uploading of questions.
 * Accepts both the raw seed file format (snake_case keys) and the DB format (camelCase).
 * Auto-transforms seed format into the DB schema before insertion.
 *
 * Optional query params:
 *   ?replace=true  — delete all existing questions for the detected subject before inserting
 *   ?subject=X     — override the subject name for all questions in the payload
 */
exports.bulkUploadQuestions = async (req, res) => {
  try {
    const questionsData = req.body;

    // Ensure the payload is an array
    if (!Array.isArray(questionsData)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload format. Expected a JSON array of question objects.',
      });
    }

    if (questionsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'The array is empty. Please provide at least one question.',
      });
    }

    const subjectOverride = req.query.subject || null;
    const replaceExisting = req.query.replace === 'true';

    // Transform all questions from seed format to DB format
    const transformed = questionsData.map(q => transformQuestion(q, subjectOverride));

    // Detect the subject(s) in the payload
    const detectedSubjects = [...new Set(transformed.map(q => q.subject))];

    // Validate each question against the Mongoose schema
    const errors = [];
    const validQuestions = [];

    transformed.forEach((qData, index) => {
      const questionInstance = new Question(qData);
      const validationError = questionInstance.validateSync();

      if (validationError) {
        const fieldErrors = {};
        for (const field in validationError.errors) {
          fieldErrors[field] = validationError.errors[field].message;
        }
        errors.push({ index, providedData: questionsData[index], errors: fieldErrors });
      } else {
        validQuestions.push(qData);
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Validation failed for ${errors.length} question(s). Fix them and retry.`,
        errorCount: errors.length,
        validCount: validQuestions.length,
        detectedSubjects,
        details: errors.slice(0, 10), // Only return first 10 to avoid huge payloads
      });
    }

    // If replace mode, remove existing questions for these subjects first
    let deletedCount = 0;
    if (replaceExisting && detectedSubjects.length > 0) {
      const deleteResult = await Question.deleteMany({ subject: { $in: detectedSubjects } });
      deletedCount = deleteResult.deletedCount;
    }

    // Bulk insert
    const result = await Question.insertMany(validQuestions, { ordered: false });

    res.status(201).json({
      success: true,
      message: `Successfully uploaded ${result.length} questions.`,
      detectedSubjects,
      insertedCount: result.length,
      deletedCount,
    });
  } catch (error) {
    console.error('Error during bulk upload:', error);

    if (error.name === 'BulkWriteError') {
      return res.status(500).json({
        success: false,
        message: 'A database bulk write error occurred during insertion.',
        details: error.writeErrors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'An unexpected server error occurred.',
      error: error.message,
    });
  }
};
