let _counter = 0;

export const generateId = (prefix: string = "el") =>
  `${prefix}-${Date.now().toString(36)}-${(++_counter).toString(36)}`;
