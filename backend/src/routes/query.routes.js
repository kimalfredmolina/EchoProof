const express = require('express');
const { queryContext } = require('../controllers/query.controller');
const { queryRateLimit } = require('../middleware/query-rate-limit');

const router = express.Router();

router.post('/:id/query', queryRateLimit, queryContext);

module.exports = router;
