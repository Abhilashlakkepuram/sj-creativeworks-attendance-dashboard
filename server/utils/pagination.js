/**
 * Reusable Pagination Helper
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} - Object containing skip and limit values
 */
const getPagination = (page, limit) => {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 10);
    const skip = (pageNum - 1) * limitNum;
    
    return { skip, limit: limitNum, page: pageNum };
};

/**
 * Standard Paginated Response Formatter
 * @param {Array} data - Paginated data
 * @param {number} total - Total count in DB
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} - Formatted JSON response object
 */
const formatPagination = (data, total, page, limit) => {
    return {
        success: true,
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
};

module.exports = { getPagination, formatPagination };
