import { Router } from 'express';
import { buildDailyChallenge } from '../services/dailyGenerator.js';

export const dailyRouter = Router();

dailyRouter.get('/daily', (req, res) => {
  // Optional ?date=YYYY-MM-DD for debugging / sharing past challenges.
  const dateParam = req.query.date;
  const challenge = dateParam
    ? buildDailyChallenge(String(dateParam))
    : buildDailyChallenge();
  res.json(challenge);
});
