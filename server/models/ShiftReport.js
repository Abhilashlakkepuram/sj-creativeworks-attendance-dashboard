const mongoose = require('mongoose');

const shiftReportSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employeeName: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  hours: [
    {
      slot: {
        type: String,
        required: true
      },
      tasksCompleted: {
        type: String,
        required: true,
        minlength: 10
      },
      blockers: {
        type: String,
        default: ""
      }
    }
  ],
  overallNotes: {
    type: String,
    maxlength: 500,
    default: ""
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'flagged'],
    default: 'pending'
  },
  adminNote: {
    type: String,
    default: ""
  }
});

shiftReportSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ShiftReport', shiftReportSchema);
