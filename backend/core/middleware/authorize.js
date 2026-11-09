export function authorize(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return response.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

export function requireApprovedVerification(request, response, next) {
  if (request.user?.status !== 'active' || request.user?.verification_status !== 'approved') {
    return response.status(403).json({ message: 'Your account must be approved before you can perform this action.' });
  }
  return next();
}
