function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Please log in first." });
  }
  next();
}

function publicUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    campus_id: user.campus_id,
    department: user.department,
    phone: user.phone
  };
}

module.exports = { requireAuth, publicUser };
