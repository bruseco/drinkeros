const KEY = 'drinkeros:admin_mode';

export const isAdminModeOn = (): boolean => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export const setAdminMode = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};
