import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  username: {
    type: String,
    required: true,
    trim: true,
  },
  // Stored AES-256 encrypted
  encryptedPassword: {
    type: String,
    required: true,
  },
  // Stored AES-256 encrypted (optional)
  encryptedSharedSecret: {
    type: String,
    default: null,
  },
  gameIds: {
    type: [Number],
    default: [],
  },
  status: {
    type: String,
    enum: ['offline', 'connecting', 'online', 'error'],
    default: 'offline',
  },
  lastError: {
    type: String,
    default: null,
  },
  notes: {
    type: String,
    default: '',
  },
}, { timestamps: true });

// Never expose encrypted fields to the client
accountSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.encryptedPassword;
  delete obj.encryptedSharedSecret;
  return obj;
};

export default mongoose.model('Account', accountSchema);
