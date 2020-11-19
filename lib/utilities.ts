type UnwrapPromise<P> = P extends Promise<infer U> ? U : P;

export class CancelledPromise extends Error {
    public cancelled = true;

    constructor(message: string, cancelled: boolean) {
        super(message);

        this.cancelled = cancelled;
    }
}

export class CancellablePromise<P, T = UnwrapPromise<P>> {
    private cancelled = false;
    private resolved = false;
    private cancelFn: () => void = () => { /* no-op */ };
    private readonly wrappedPromise: Promise<T>;
    private readonly onCancel?: boolean | (() => void);

    /**
     * Create a cancellable promise by wrapping an existing promise
     * @param promise
     * @param onCancel
     */
    constructor(promise: Promise<T>, onCancel?: boolean | (() => void)) {
        this.onCancel = onCancel;

        this.wrappedPromise = new Promise((res, rej) => {
            this.cancelFn = (): void => {
                rej(new CancelledPromise("Promise Cancelled", this.cancelled));
            };

            promise.then(
                val => this.cancelled ? rej(new CancelledPromise("Promise Cancelled", this.cancelled)) : res(val),
                error => this.cancelled ? rej(new CancelledPromise("Promise Cancelled", this.cancelled)) : rej(error)
            )
                .then(() => {
                    this.resolved = true;
                });
        });

        this.cancel = this.cancel.bind(this);
    }

    /**
     * Cancel the wrapped promise
     */
    public cancel(): void {
        if(this.cancelled || this.resolved) {
            return;
        }

        this.cancelled = true;

        if(typeof this.onCancel === "boolean" && this.onCancel) {
            this.cancelFn();
        } else if(typeof this.onCancel === "function") {
            this.onCancel();
            this.cancelFn();
        }
    }

    /**
     * Return the wrapped promise
     * @returns {boolean}
     */
    public get promise(): Promise<T> {
        return this.wrappedPromise;
    }
}

/**
 * Compare two object together
 * Uses exact ("===") comparision
 *
 * @param a
 * @param b
 * @returns {boolean} True if they are the same, False otherwise
 */
export function compare(a: unknown, b: unknown): boolean {
    if(typeof a !== typeof b) {
        return false;
    }

    b = b as typeof a;

    if(Array.isArray(a) && Array.isArray(b)) {
        if(a.length !== b.length) {
            return false;
        }

        for(let i = 0, l = a.length; i < l; i++) {
            if(!compare(a[i], b[i])) {
                return false;
            }
        }
    } else if(typeof a === "object" && typeof b === "object") {
        if(a === null && b === null) {
            return true;
        } else if(a === null || b === null) {
            return false;
        }

        if(Object.keys(a).length !== Object.keys(b).length) {
            return false;
        }

        for(const i in a) {
            if(!Object.prototype.hasOwnProperty.call(a, i)) continue;

            if(!compare(a[i as keyof typeof a], b[i as keyof typeof b])) {
                return false;
            }
        }
    } else if(typeof a === "number" && typeof b === "number") {
        if (isNaN(a) && isNaN(b)) {
            return true;
        }

        return a === b;
    } else {
        return a === b;
    }

    return true;
}

/**
 * A faster deep clone than `JSON.parse(JSON.stringify(obj))`
 * @param obj
 */
export function clone<T>(obj: T): T {
    let c: any;
    if(Array.isArray(obj)) {
        c = [];
        for(let i = 0, l = obj.length; i < l; i++) {
            c[i] = clone(obj[i]);
        }
    } else if(typeof obj === "object" && obj !== null) {
        c = {};
        for(const i in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;

            c[i] = clone(obj[i]);
        }
    } else {
        c = obj;
    }

    return c;
}
