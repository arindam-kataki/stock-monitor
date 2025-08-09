import { Router } from 'express';
import { categoryController } from '../controllers/categoryController';

const router = Router();

router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);
router.post('/', categoryController.createCategory);
router.put('/:id', categoryController.updateCategory);
router.post('/:id/stocks', categoryController.addStock);
router.delete('/:id/stocks/:symbol', categoryController.removeStock);

export default router;
