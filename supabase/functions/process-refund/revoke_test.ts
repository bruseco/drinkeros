import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { revokeClubeAccess } from "./revoke.ts";

type Call = { table: string; op: string; payload?: any; filters: Record<string, any> };

function makeFakeSupabase(opts: { planError?: any; deleteError?: any; throwOn?: string } = {}) {
  const calls: Call[] = [];

  function builder(table: string, op: string, payload?: any) {
    const filters: Record<string, any> = {};
    const call: Call = { table, op, payload, filters };
    calls.push(call);

    const chain: any = {
      eq(col: string, val: any) {
        filters[col] = val;
        if (opts.throwOn === `${table}.${op}`) {
          return Promise.reject(new Error(`boom-${table}-${op}`));
        }
        // Resolve when the chain is awaited. For deletes/updates, terminal eq returns result.
        return chain;
      },
      then(resolve: any, reject: any) {
        if (opts.throwOn === `${table}.${op}`) {
          return Promise.reject(new Error(`boom-${table}-${op}`)).then(resolve, reject);
        }
        const error =
          table === 'user_plans' && op === 'update' ? opts.planError ?? null :
          table === 'user_courses' && op === 'delete' ? opts.deleteError ?? null :
          null;
        return Promise.resolve({ data: null, error }).then(resolve, reject);
      },
    };
    return chain;
  }

  return {
    calls,
    from(table: string) {
      return {
        update(payload: any) { return builder(table, 'update', payload); },
        delete() { return builder(table, 'delete'); },
      };
    },
  };
}

Deno.test("revokeClubeAccess: downgrades plan and deletes vip_bonus courses", async () => {
  const sb = makeFakeSupabase();
  const result = await revokeClubeAccess(sb as any, "user-123");

  assertEquals(result.planUpdated, true);
  assertEquals(result.bonusCoursesDeleted, true);
  assertEquals(result.errors, []);

  const planCall = sb.calls.find(c => c.table === 'user_plans' && c.op === 'update');
  assertEquals(planCall?.payload, { plan: 'free', expires_at: null, source: 'refund' });
  assertEquals(planCall?.filters.user_id, 'user-123');

  const delCall = sb.calls.find(c => c.table === 'user_courses' && c.op === 'delete');
  assertEquals(delCall?.filters.user_id, 'user-123');
  assertEquals(delCall?.filters.source, 'vip_bonus');
});

Deno.test("revokeClubeAccess: returns error when missing userId, no calls", async () => {
  const sb = makeFakeSupabase();
  const result = await revokeClubeAccess(sb as any, "");
  assertEquals(result.planUpdated, false);
  assertEquals(result.bonusCoursesDeleted, false);
  assertEquals(result.errors.length, 1);
  assertEquals(sb.calls.length, 0);
});

Deno.test("revokeClubeAccess: still deletes courses if plan update fails", async () => {
  const sb = makeFakeSupabase({ planError: { message: 'plan-fail' } });
  const result = await revokeClubeAccess(sb as any, "user-x");
  assertEquals(result.planUpdated, false);
  assertEquals(result.bonusCoursesDeleted, true);
  assertEquals(result.errors[0].includes('plan-fail'), true);
  // verify delete still happened
  const delCall = sb.calls.find(c => c.table === 'user_courses' && c.op === 'delete');
  assertEquals(delCall?.filters.source, 'vip_bonus');
});

Deno.test("revokeClubeAccess: reports delete error but plan update succeeds", async () => {
  const sb = makeFakeSupabase({ deleteError: { message: 'del-fail' } });
  const result = await revokeClubeAccess(sb as any, "user-y");
  assertEquals(result.planUpdated, true);
  assertEquals(result.bonusCoursesDeleted, false);
  assertEquals(result.errors[0].includes('del-fail'), true);
});

Deno.test("revokeClubeAccess: catches thrown errors from supabase client", async () => {
  const sb = makeFakeSupabase({ throwOn: 'user_plans.update' });
  const result = await revokeClubeAccess(sb as any, "user-z");
  assertEquals(result.planUpdated, false);
  assertEquals(result.bonusCoursesDeleted, true);
  assertEquals(result.errors.some(e => e.includes('boom-user_plans-update')), true);
});
