const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether this could be a row's ID. The database answers anything else with an error, not "no such row". */
export const isUuid = (value: string | undefined): boolean => !!value && UUID_PATTERN.test(value);
