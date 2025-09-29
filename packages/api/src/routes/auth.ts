import {Router} from 'express';
import jwt from 'jsonwebtoken';
// @ts-ignore
import {getJwtSecret} from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login and get a JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId:
 *                 type: string
 *               clientSecret:
 *                 type: string
 *           example:
 *             clientId: your_client_id
 *             clientSecret: your_client_secret
 *     responses:
 *       200:
 *         description: JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 */
router.post('/login', (req, res) => {
    const {clientId, clientSecret} = req.body;
    const validId = process.env.DASHBOARD_CLIENT_ID;
    const validSecret = process.env.DASHBOARD_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return res.status(400).json({error: 'clientId and clientSecret required'});
    }
    if (clientId !== validId || clientSecret !== validSecret) {
        return res.status(401).json({error: 'Invalid credentials'});
    }
    // Issue JWT for dashboard service
    const token = jwt.sign({service: 'dashboard'}, getJwtSecret(), {expiresIn: '1d'});
    res.json({token});
});

export default router;
