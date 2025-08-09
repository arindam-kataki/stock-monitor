import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSelection extends Document {
  userId?: string; // Optional for now, can add auth later
  categoryId: string;
  selectedStocks: string[];
  settings: {
    autoCycle: boolean;
    cycleInterval: number;
    showVolume: boolean;
    enableNotifications: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSelectionSchema = new Schema<IUserSelection>(
  {
    userId: { type: String, default: 'default-user' },
    categoryId: { type: String, required: true },
    selectedStocks: [{ type: String }],
    settings: {
      autoCycle: { type: Boolean, default: true },
      cycleInterval: { type: Number, default: 15 },
      showVolume: { type: Boolean, default: true },
      enableNotifications: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUserSelection>(
  'UserSelection',
  UserSelectionSchema
);
