export function validate(requiredFields) {
  return (request, response, next) => {
    const missing = requiredFields.filter((field) => {
      const value = request.body[field];
      return value === undefined || value === null || String(value).trim() === '';
    });
    if (missing.length) {
      return response.status(422).json({ message: `Missing required fields: ${missing.join(', ')}.` });
    }
    next();
  };
}
