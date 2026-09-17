const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  stream: {
    type: String,
    enum: ['civil', 'ssc_cgl', 'banking'],
    default: 'civil',
    index: true,
  },
  subject: { type: String, required: true },
  topic: { type: String, required: false },
  category: {
    type: String,
    enum: ['tech', 'gs'],
    default: 'tech',
    required: function () {
      return (this.stream ?? 'civil') === 'civil';
    }
  },
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

questionSchema.index({ stream: 1, subject: 1 });
questionSchema.index({ stream: 1, category: 1, subject: 1 });

module.exports = mongoose.model('Question', questionSchema);
