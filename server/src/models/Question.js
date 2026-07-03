const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  topic: { type: String, required: false },
  category: { type: String, enum: ['tech', 'gs'], default: 'tech' },
  questionNumber: { type: String },
  questionText: { type: String, required: true },
  options: {
    a: { type: String, required: true },
    b: { type: String, required: true },
    c: { type: String, required: true },
    d: { type: String, required: true }
  },
  correctOption: { type: String, required: true },
  explanation: { type: String, required: true },
  hasDiagram: { type: Boolean, default: false },
  diagramUrl: { type: String, default: null }
});

module.exports = mongoose.model('Question', questionSchema);
