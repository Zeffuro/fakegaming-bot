import type {Request, Response, NextFunction} from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({error: 'Unauthorized', message: err.message});
    }
    if (err.status === 400) {
        return res.status(400).json({error: 'Bad Request', message: err.message});
    }
    if (err.status === 404) {
        return res.status(404).json({error: 'Not Found', message: err.message});
    }
    // Fallback for other errors
    console.error(err);
    res.status(500).json({error: 'Internal Server Error', message: err.message || 'Unexpected error'});
}