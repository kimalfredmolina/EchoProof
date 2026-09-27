const express = require('express');
const router = express.Router();
const { createContext, getContext, getContextStatus } = require('../controllers/context.controller');
const { debugContext } = require('../controllers/debug.controller');
const { queryContext } = require('../controllers/query.controller');

router.post('/', createContext);
router.post('/:id/debug', debugContext);
router.get('/:id', getContext);
router.get('/:id/status', getContextStatus);
router.post('/:id/query', queryContext);

module.exports = router;
