// Minimal job queue interfaces (DB-backed now; Redis later)

/**
 * Describes a unit of work delivered by the queue
 */
export interface Job<T = unknown> {
    id: string;
    name: string;
    data: T;
    attempts: number;
    /** Marks the job as completed (no-op for adapters that auto-ack on resolve). */
    done(): Promise<void>;
}

/**
 * Handler function for a job payload
 */
export type JobHandler<T = unknown> = (job: Job<T>) => Promise<void>;

/**
 * Common job queue interface (single Postgres impl provided initially)
 */
export interface JobQueue {
    /** Initialize the queue/worker connections */
    start(): Promise<void>;
    /** Gracefully stop the queue/worker connections */
    stop(): Promise<void>;
    /**
     * Register a job handler for the given name. Multiple handlers per name are allowed; adapter defines concurrency.
     */
    on<T = unknown>(name: string, handler: JobHandler<T>): void;
    /**
     * Enqueue a job for immediate or delayed execution.
     * Returns the provider job id.
     */
    schedule<T = unknown>(
        name: string,
        data: T,
        options?: {
            /** Delay before execution, in seconds */
            startAfterSeconds?: number;
            /** Optional idempotency key; semantics depend on adapter */
            idempotencyKey?: string;
            /** Optional priority (higher runs earlier); adapter-specific */
            priority?: number;
        }
    ): Promise<string>;
}

export { MemoryJobQueue } from './memory.js';
