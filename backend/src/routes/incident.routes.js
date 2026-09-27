const express = require('express');
const { createIncident, listIncidents, getIncident } = require('../controllers/incident.controller');

const router = express.Router({ mergeParams: true });

router.post('/:id/incidents', createIncident);
router.get('/:id/incidents', listIncidents);
router.get('/:id/incidents/:incidentId', getIncident);

module.exports = router;
