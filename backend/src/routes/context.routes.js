const express = require('express');
const router = express.Router();
const { createContext, getContext, getContextStatus } = require('../controllers/context.controller');

router.post('/', createContext);
router.get('/:id', getContext);
router.get('/:id/status', getContextStatus);

module.exports = router;
