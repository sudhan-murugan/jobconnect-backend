/**
 * Health check: a cheap endpoint that load balancers and hosting platforms
 * (e.g. Render) call to check that the server is up.
 */
const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;
