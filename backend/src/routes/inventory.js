const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createItem, getItems, updateItem, stockIn, adjustStock, getLedger,
  createIndent, getIndents, reviewIndent, fulfillIndent, cancelIndent,
} = require('../controllers/inventoryController');

router.use(protect);

// Item master — managed by admin/finance (acting as store management)
router.get('/items', getItems);
router.post('/items', authorize('admin', 'finance'), createItem);
router.put('/items/:id', authorize('admin', 'finance'), updateItem);
router.put('/items/:id/stock-in', authorize('admin', 'finance'), stockIn);
router.put('/items/:id/adjust', authorize('admin', 'finance'), adjustStock);
router.get('/items/:id/ledger', authorize('admin', 'finance'), getLedger);

// Indents — any staff role can request; only store management reviews/fulfills
router.get('/indents', getIndents);
router.post('/indents', createIndent);
router.put('/indents/:id/review', authorize('admin', 'finance'), reviewIndent);
router.put('/indents/:id/fulfill', authorize('admin', 'finance'), fulfillIndent);
router.put('/indents/:id/cancel', cancelIndent);

module.exports = router;
