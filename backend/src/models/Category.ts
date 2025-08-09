import mongoose, { Schema, Document } from 'mongoose';

export interface IStock {
  symbol: string;
  name: string;
  description?: string;
  sector?: string;
  marketCap?: string;
  addedDate?: Date;
}

export interface ICategory extends Document {
  id: string;
  name: string;
  icon: string;
  description?: string;
  stocks: IStock[];
  color?: string;
  order?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StockSchema = new Schema<IStock>({
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  sector: { type: String },
  marketCap: { type: String },
  addedDate: { type: Date, default: Date.now },
});

const CategorySchema = new Schema<ICategory>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icon: { type: String, required: true },
    description: { type: String },
    stocks: [StockSchema],
    color: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ICategory>('Category', CategorySchema);
