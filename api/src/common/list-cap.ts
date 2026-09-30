/**
 * Upper bound on any list endpoint that returns a plain array (newest first). A boutique's per-customer and per-product
 * lists stay far below this; it exists so one account, product or admin table can never turn into an unbounded query.
 */
export const LIST_CAP = 200;
