// const User = require('../models/User');
// const Appointment = require('../models/Appointment');
// const Order = require('../models/Order');
// const { Alert } = require('../models/Models');

// exports.getDashboardAnalytics = async (req, res) => {
//   try {
//     const now = new Date();
//     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//     const startOfYear = new Date(now.getFullYear(), 0, 1);

//     const [
//       totalPatients, totalDoctors, pendingUsers,
//       totalAppointments, todayAppointments,
//       totalOrders, pendingOrders,
//       totalAlerts, activeAlerts
//     ] = await Promise.all([
//       User.countDocuments({ role: 'patient', status: 'approved' }),
//       User.countDocuments({ role: 'doctor', status: 'approved' }),
//       User.countDocuments({ status: 'pending' }),
//       Appointment.countDocuments(),
//       Appointment.countDocuments({
//         date: { $gte: new Date(now.setHours(0,0,0,0)), $lt: new Date(now.setHours(23,59,59,999)) }
//       }),
//       Order.countDocuments(),
//       Order.countDocuments({ status: { $in: ['processing', 'confirmed'] } }),
//       Alert.countDocuments(),
//       Alert.countDocuments({ status: 'pending' })
//     ]);

//     // Monthly appointments for chart
//     const monthlyAppts = await Appointment.aggregate([
//       { $match: { createdAt: { $gte: startOfYear } } },
//       { $group: { _id: { month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
//       { $sort: { '_id.month': 1 } }
//     ]);

//     // Department breakdown
//     const deptStats = await Appointment.aggregate([
//       { $group: { _id: '$department', count: { $sum: 1 } } },
//       { $sort: { count: -1 } }
//     ]);

//     // Monthly revenue (orders)
//     const monthlyRevenue = await Order.aggregate([
//       { $match: { createdAt: { $gte: startOfYear }, status: { $ne: 'cancelled' } } },
//       { $group: { _id: { month: { $month: '$createdAt' } }, revenue: { $sum: '$totalAmount' } } },
//       { $sort: { '_id.month': 1 } }
//     ]);

//     // Recent registrations
//     const recentPatients = await User.aggregate([
//       { $match: { role: 'patient', status: 'approved', createdAt: { $gte: startOfYear } } },
//       { $group: { _id: { month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
//       { $sort: { '_id.month': 1 } }
//     ]);

//     res.json({
//       success: true,
//       data: {
//         summary: {
//           totalPatients, totalDoctors, pendingUsers,
//           totalAppointments, todayAppointments,
//           totalOrders, pendingOrders,
//           totalAlerts, activeAlerts
//         },
//         charts: {
//           monthlyAppointments: monthlyAppts,
//           departmentStats: deptStats,
//           monthlyRevenue,
//           recentPatients
//         }
//       }
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Order = require('../models/Order');
const Review = require('../models/Review');
const { Alert } = require('../models/Models');

exports.getDashboardAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const today = new Date();
    today.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    const [
      totalPatients, totalDoctors, pendingUsers, approvedUsers, totalUsers,
      totalAppointments, todayAppointments,
      totalOrders, pendingOrders,
      totalAlerts, activeAlerts
    ] = await Promise.all([
      User.countDocuments({ role: 'patient', status: 'approved' }),
      User.countDocuments({ role: 'doctor', status: 'approved' }),
      User.countDocuments({ status: 'pending' }),
      User.countDocuments({ status: 'approved' }),
      User.countDocuments(),
      Appointment.countDocuments(),
      Appointment.countDocuments({ date: { $gte: today, $lte: todayEnd } }),
      Order.countDocuments(),
      Order.countDocuments({ status: { $in: ['processing', 'confirmed'] } }),
      Alert.countDocuments(),
      Alert.countDocuments({ status: 'pending' })
    ]);

    // Monthly appointments for chart
    const monthlyAppts = await Appointment.aggregate([
      { $match: { createdAt: { $gte: startOfYear } } },
      { $group: { _id: { month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.month': 1 } }
    ]);

    // Department breakdown
    const deptStats = await Appointment.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Monthly revenue (orders)
    const monthlyRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: startOfYear }, status: { $ne: 'cancelled' } } },
      { $group: { _id: { month: { $month: '$createdAt' } }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { '_id.month': 1 } }
    ]);

    // Recent registrations
    const recentPatients = await User.aggregate([
      { $match: { role: 'patient', status: 'approved', createdAt: { $gte: startOfYear } } },
      { $group: { _id: { month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.month': 1 } }
    ]);

    // Real daily patient visits for the last 7 days (replaces any
    // hardcoded/static "Mon-Sun" sample numbers on the dashboard charts)
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const dailyVisitsRaw = await Appointment.aggregate([
      { $match: { date: { $gte: sevenDaysAgo, $lte: todayEnd } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: 1 }, confirmed: { $sum: { $cond: [{ $in: ['$status', ['confirmed','completed']] }, 1, 0] } } } },
      { $sort: { _id: 1 } }
    ]);
    // Fill in any missing days with zero so the chart always shows 7 real days
    const dailyVisits = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = dailyVisitsRaw.find(r => r._id === key);
      dailyVisits.push({ date: key, label: d.toLocaleDateString('en-IN', { weekday: 'short' }), total: found?.total || 0, confirmed: found?.confirmed || 0 });
    }

    // Real medicine sales by category — unwind order items, join to Medicine
    // for category, sum quantity sold (replaces the static Pain Relief/
    // Antibiotics/... sample numbers previously shown on Analytics page)
    const medicineSalesByCategory = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      { $lookup: { from: 'medicines', localField: 'items.medicine', foreignField: '_id', as: 'med' } },
      { $unwind: { path: '$med', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ['$med.category', 'Other'] }, unitsSold: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' } } },
      { $sort: { unitsSold: -1 } }
    ]);

    // Doctor ratings rollup — average + count per doctor, computed live from
    // actual patient reviews (never a fabricated/static number). Sorted best
    // first, but only doctors with at least one review are included so a
    // brand-new doctor with zero reviews doesn't show a misleading 0-star row.
    const doctorRatingsRaw = await Review.aggregate([
      { $group: { _id: '$doctor', avgRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
      { $sort: { avgRating: -1 } },
    ]);
    const doctorIds = doctorRatingsRaw.map(r => r._id);
    const doctorUsers = await User.find({ _id: { $in: doctorIds } }).select('name specialization department');
    const doctorMap = {};
    doctorUsers.forEach(d => { doctorMap[d._id] = d; });
    const doctorRatings = doctorRatingsRaw.map(r => ({
      doctorId: r._id,
      name: doctorMap[r._id]?.name || 'Unknown',
      specialization: doctorMap[r._id]?.specialization || '',
      department: doctorMap[r._id]?.department || '',
      avgRating: Math.round(r.avgRating * 10) / 10,
      reviewCount: r.reviewCount,
    }));
    const overallAvgRating = doctorRatings.length
      ? Math.round((doctorRatings.reduce((s, d) => s + d.avgRating * d.reviewCount, 0) / doctorRatings.reduce((s, d) => s + d.reviewCount, 0)) * 10) / 10
      : null;

    res.json({
      success: true,
      data: {
        summary: {
          totalPatients, totalDoctors, pendingUsers, approvedUsers, totalUsers,
          totalAppointments, todayAppointments,
          totalOrders, pendingOrders,
          totalAlerts, activeAlerts,
          // aliases for Dashboard.js compatibility
          activeAlerts: activeAlerts,
          pendingApprovals: pendingUsers,
          overallAvgRating,
        },
        charts: {
          monthlyAppointments: monthlyAppts,
          departmentStats: deptStats,
          monthlyRevenue,
          recentPatients,
          dailyVisits,
          medicineSalesByCategory,
          doctorRatings,
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};