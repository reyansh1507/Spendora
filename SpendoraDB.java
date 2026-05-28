// ═══════════════════════════════════════════════════
//  SPENDORA — SpendoraDB.java
//  JDBC Data Access Layer
//  Requirements: Java 11+, PostgreSQL (or MySQL — see comments)
//  Maven: org.postgresql:postgresql:42.7.3
// ═══════════════════════════════════════════════════

package com.spendora.db;

import java.sql.*;
import java.time.LocalDate;
import java.util.*;

/**
 * SpendoraDB — single-class JDBC data access layer.
 *
 * Tables created automatically via initSchema().
 *
 * Usage:
 *   SpendoraDB db = new SpendoraDB("jdbc:postgresql://localhost:5432/spendora", "user", "pass");
 *   db.initSchema();
 *   long uid = db.registerUser("Alice", "alice@example.com", "hashed_password");
 *   List<Expense> expenses = db.getExpenses(uid, LocalDate.now());
 */
public class SpendoraDB implements AutoCloseable {

    // ── CONNECTION ──────────────────────────────────
    private final Connection conn;

    public SpendoraDB(String jdbcUrl, String user, String password) throws SQLException {
        this.conn = DriverManager.getConnection(jdbcUrl, user, password);
        this.conn.setAutoCommit(true);
    }

    /** Alternative constructor — pass an existing Connection (e.g. from a pool). */
    public SpendoraDB(Connection existingConnection) {
        this.conn = existingConnection;
    }

    @Override
    public void close() throws SQLException {
        if (conn != null && !conn.isClosed()) conn.close();
    }

    // ══════════════════════════════════════════════
    //  SCHEMA INIT
    // ══════════════════════════════════════════════
    /**
     * Create all tables if they do not already exist.
     * Call once at application startup.
     *
     * MySQL users: replace SERIAL with AUTO_INCREMENT, TEXT with VARCHAR(255), etc.
     */
    public void initSchema() throws SQLException {
        String[] ddl = {
            // users
            """
            CREATE TABLE IF NOT EXISTS spendora_users (
                id         SERIAL PRIMARY KEY,
                name       TEXT        NOT NULL,
                email      TEXT UNIQUE NOT NULL,
                password   TEXT        NOT NULL,   -- store BCrypt hash, NOT plain text
                created_at TIMESTAMP   DEFAULT NOW()
            )
            """,

            // monthly budget
            """
            CREATE TABLE IF NOT EXISTS spendora_budgets (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER NOT NULL REFERENCES spendora_users(id) ON DELETE CASCADE,
                year       SMALLINT NOT NULL,
                month      SMALLINT NOT NULL,   -- 1-12
                amount     NUMERIC(12,2) NOT NULL,
                UNIQUE (user_id, year, month)
            )
            """,

            // daily expenses
            """
            CREATE TABLE IF NOT EXISTS spendora_expenses (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES spendora_users(id) ON DELETE CASCADE,
                expense_date DATE    NOT NULL,
                description TEXT,
                category    TEXT,
                amount      NUMERIC(12,2) NOT NULL,
                created_at  TIMESTAMP DEFAULT NOW()
            )
            """,

            // subscriptions  (month-scoped, same as localStorage model)
            """
            CREATE TABLE IF NOT EXISTS spendora_subscriptions (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER NOT NULL REFERENCES spendora_users(id) ON DELETE CASCADE,
                year        SMALLINT NOT NULL,
                month       SMALLINT NOT NULL,
                name        TEXT,
                category    TEXT,
                cycle       TEXT     DEFAULT 'Monthly',
                due_day     SMALLINT,           -- day of month 1-31
                amount      NUMERIC(12,2) NOT NULL,
                status      TEXT     DEFAULT 'Active',  -- Active / Paused / Cancelled
                created_at  TIMESTAMP DEFAULT NOW()
            )
            """
        };

        try (Statement st = conn.createStatement()) {
            for (String sql : ddl) st.execute(sql);
        }
        System.out.println("[SpendoraDB] Schema ready.");
    }

    // ══════════════════════════════════════════════
    //  DATA CLASSES  (simple POJOs / records)
    // ══════════════════════════════════════════════
    public record User(long id, String name, String email, Timestamp createdAt) {}

    public record Budget(long id, long userId, int year, int month, double amount) {}

    public record Expense(long id, long userId, LocalDate date,
                          String description, String category, double amount) {}

    public record Subscription(long id, long userId, int year, int month,
                                String name, String category, String cycle,
                                Integer dueDay, double amount, String status) {}

    // ══════════════════════════════════════════════
    //  USER OPERATIONS
    // ══════════════════════════════════════════════
    /**
     * Register a new user.
     * @param hashedPassword  A BCrypt/Argon2 hash — NEVER store plain text.
     * @return generated user id
     */
    public long registerUser(String name, String email, String hashedPassword) throws SQLException {
        String sql = "INSERT INTO spendora_users (name, email, password) VALUES (?, ?, ?) RETURNING id";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, name);
            ps.setString(2, email);
            ps.setString(3, hashedPassword);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getLong(1);
            }
        }
    }

    /**
     * Find user by email (used for sign-in).
     * Returns null if not found.
     */
    public User findUserByEmail(String email) throws SQLException {
        String sql = "SELECT id, name, email, created_at FROM spendora_users WHERE email = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return new User(rs.getLong("id"), rs.getString("name"),
                                rs.getString("email"), rs.getTimestamp("created_at"));
            }
        }
    }

    /**
     * Retrieve the stored password hash for verification.
     * Compare with BCrypt.checkpw(plainText, storedHash) in your auth layer.
     */
    public String getPasswordHash(String email) throws SQLException {
        String sql = "SELECT password FROM spendora_users WHERE email = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString("password") : null;
            }
        }
    }

    // ══════════════════════════════════════════════
    //  BUDGET OPERATIONS
    // ══════════════════════════════════════════════
    /** Upsert monthly budget (create or update). */
    public void setBudget(long userId, int year, int month, double amount) throws SQLException {
        String sql = """
            INSERT INTO spendora_budgets (user_id, year, month, amount)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (user_id, year, month)
            DO UPDATE SET amount = EXCLUDED.amount
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, userId);
            ps.setInt(2, year);
            ps.setInt(3, month);
            ps.setDouble(4, amount);
            ps.executeUpdate();
        }
    }

    /** Get budget for a specific month. Returns 0 if not set. */
    public double getBudget(long userId, int year, int month) throws SQLException {
        String sql = "SELECT amount FROM spendora_budgets WHERE user_id=? AND year=? AND month=?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, userId); ps.setInt(2, year); ps.setInt(3, month);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getDouble("amount") : 0.0;
            }
        }
    }

    // ══════════════════════════════════════════════
    //  EXPENSE OPERATIONS
    // ══════════════════════════════════════════════
    /** Add a single expense entry. Returns generated id. */
    public long addExpense(long userId, LocalDate date, String description,
                           String category, double amount) throws SQLException {
        String sql = """
            INSERT INTO spendora_expenses (user_id, expense_date, description, category, amount)
            VALUES (?, ?, ?, ?, ?) RETURNING id
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, userId);
            ps.setDate(2, Date.valueOf(date));
            ps.setString(3, description);
            ps.setString(4, category);
            ps.setDouble(5, amount);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next(); return rs.getLong(1);
            }
        }
    }

    /** Get all expenses for a single day. */
    public List<Expense> getExpenses(long userId, LocalDate date) throws SQLException {
        String sql = """
            SELECT id, user_id, expense_date, description, category, amount
            FROM spendora_expenses
            WHERE user_id = ? AND expense_date = ?
            ORDER BY id ASC
            """;
        return queryExpenses(sql, ps -> { ps.setLong(1,userId); ps.setDate(2,Date.valueOf(date)); });
    }

    /** Get all expenses for a given month. */
    public List<Expense> getMonthlyExpenses(long userId, int year, int month) throws SQLException {
        String sql = """
            SELECT id, user_id, expense_date, description, category, amount
            FROM spendora_expenses
            WHERE user_id = ? AND EXTRACT(YEAR FROM expense_date)=? AND EXTRACT(MONTH FROM expense_date)=?
            ORDER BY expense_date ASC, id ASC
            """;
        return queryExpenses(sql, ps -> { ps.setLong(1,userId); ps.setInt(2,year); ps.setInt(3,month); });
    }

    /** Monthly totals for last N months (for bar chart). */
    public List<MonthlyTotal> getMonthlyTotals(long userId, int months) throws SQLException {
        String sql = """
            SELECT EXTRACT(YEAR FROM expense_date)::int  AS yr,
                   EXTRACT(MONTH FROM expense_date)::int AS mo,
                   SUM(amount) AS total
            FROM spendora_expenses
            WHERE user_id = ?
              AND expense_date >= CURRENT_DATE - INTERVAL '1 month' * ?
            GROUP BY yr, mo
            ORDER BY yr, mo
            """;
        List<MonthlyTotal> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, userId); ps.setInt(2, months);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next())
                    list.add(new MonthlyTotal(rs.getInt("yr"), rs.getInt("mo"), rs.getDouble("total")));
            }
        }
        return list;
    }

    public record MonthlyTotal(int year, int month, double total) {}

    /** Category breakdown for a given month. */
    public Map<String,Double> getCategoryBreakdown(long userId, int year, int month) throws SQLException {
        String sql = """
            SELECT category, SUM(amount) AS total
            FROM spendora_expenses
            WHERE user_id=? AND EXTRACT(YEAR FROM expense_date)=? AND EXTRACT(MONTH FROM expense_date)=?
            GROUP BY category
            ORDER BY total DESC
            """;
        Map<String,Double> map = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1,userId); ps.setInt(2,year); ps.setInt(3,month);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) map.put(rs.getString("category"), rs.getDouble("total"));
            }
        }
        return map;
    }

    /** Update description, category, or amount of an expense. */
    public void updateExpense(long expenseId, String description, String category, double amount) throws SQLException {
        String sql = "UPDATE spendora_expenses SET description=?, category=?, amount=? WHERE id=?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1,description); ps.setString(2,category);
            ps.setDouble(3,amount);      ps.setLong(4,expenseId);
            ps.executeUpdate();
        }
    }

    /** Delete a single expense by id. */
    public void deleteExpense(long expenseId) throws SQLException {
        exec("DELETE FROM spendora_expenses WHERE id=?", expenseId);
    }

    /** Delete all expenses for a user on a given day (Clear All). */
    public void clearDayExpenses(long userId, LocalDate date) throws SQLException {
        String sql = "DELETE FROM spendora_expenses WHERE user_id=? AND expense_date=?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1,userId); ps.setDate(2,Date.valueOf(date)); ps.executeUpdate();
        }
    }

    // ══════════════════════════════════════════════
    //  SUBSCRIPTION OPERATIONS
    // ══════════════════════════════════════════════
    /** Add a subscription for the given month. Returns generated id. */
    public long addSubscription(long userId, int year, int month, String name,
                                 String category, String cycle, Integer dueDay,
                                 double amount, String status) throws SQLException {
        String sql = """
            INSERT INTO spendora_subscriptions
              (user_id, year, month, name, category, cycle, due_day, amount, status)
            VALUES (?,?,?,?,?,?,?,?,?) RETURNING id
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1,userId); ps.setInt(2,year); ps.setInt(3,month);
            ps.setString(4,name); ps.setString(5,category); ps.setString(6,cycle);
            if (dueDay != null) ps.setInt(7,dueDay); else ps.setNull(7,Types.INTEGER);
            ps.setDouble(8,amount); ps.setString(9,status);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return rs.getLong(1); }
        }
    }

    /** Get subscriptions for a given month. */
    public List<Subscription> getSubscriptions(long userId, int year, int month) throws SQLException {
        String sql = """
            SELECT id,user_id,year,month,name,category,cycle,due_day,amount,status
            FROM spendora_subscriptions
            WHERE user_id=? AND year=? AND month=?
            ORDER BY id ASC
            """;
        List<Subscription> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1,userId); ps.setInt(2,year); ps.setInt(3,month);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Integer dd = rs.getObject("due_day") != null ? rs.getInt("due_day") : null;
                    list.add(new Subscription(rs.getLong("id"), rs.getLong("user_id"),
                        rs.getInt("year"), rs.getInt("month"), rs.getString("name"),
                        rs.getString("category"), rs.getString("cycle"), dd,
                        rs.getDouble("amount"), rs.getString("status")));
                }
            }
        }
        return list;
    }

    /** Update a subscription row. */
    public void updateSubscription(long subId, String name, String category, String cycle,
                                   Integer dueDay, double amount, String status) throws SQLException {
        String sql = """
            UPDATE spendora_subscriptions
            SET name=?,category=?,cycle=?,due_day=?,amount=?,status=?
            WHERE id=?
            """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1,name); ps.setString(2,category); ps.setString(3,cycle);
            if (dueDay!=null) ps.setInt(4,dueDay); else ps.setNull(4,Types.INTEGER);
            ps.setDouble(5,amount); ps.setString(6,status); ps.setLong(7,subId);
            ps.executeUpdate();
        }
    }

    /** Delete a subscription row. */
    public void deleteSubscription(long subId) throws SQLException {
        exec("DELETE FROM spendora_subscriptions WHERE id=?", subId);
    }

    /** Clear all subscriptions for a user/month. */
    public void clearMonthSubscriptions(long userId, int year, int month) throws SQLException {
        String sql = "DELETE FROM spendora_subscriptions WHERE user_id=? AND year=? AND month=?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1,userId); ps.setInt(2,year); ps.setInt(3,month); ps.executeUpdate();
        }
    }

    /** Monthly subscription cost totals for last N months (for trend chart). */
    public List<MonthlyTotal> getSubscriptionMonthlyTotals(long userId, int months) throws SQLException {
        // We sum toMonthly amounts for active/paused subs per month
        String sql = """
            SELECT year, month,
                   SUM(CASE cycle
                     WHEN 'Monthly'   THEN amount
                     WHEN 'Yearly'    THEN amount / 12.0
                     WHEN 'Quarterly' THEN amount / 3.0
                     WHEN 'Weekly'    THEN amount * 4.33
                     ELSE amount END) AS monthly_cost
            FROM spendora_subscriptions
            WHERE user_id=? AND status <> 'Cancelled'
              AND (year * 100 + month) >= (
                EXTRACT(YEAR FROM CURRENT_DATE)::int * 100
                + EXTRACT(MONTH FROM CURRENT_DATE)::int - ?
              )
            GROUP BY year, month
            ORDER BY year, month
            """;
        List<MonthlyTotal> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1,userId); ps.setInt(2,months);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next())
                    list.add(new MonthlyTotal(rs.getInt("year"), rs.getInt("month"), rs.getDouble("monthly_cost")));
            }
        }
        return list;
    }

    // ══════════════════════════════════════════════
    //  PRIVATE HELPERS
    // ══════════════════════════════════════════════
    @FunctionalInterface
    private interface PSetter { void set(PreparedStatement ps) throws SQLException; }

    private List<Expense> queryExpenses(String sql, PSetter setter) throws SQLException {
        List<Expense> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            setter.set(ps);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(new Expense(
                        rs.getLong("id"), rs.getLong("user_id"),
                        rs.getDate("expense_date").toLocalDate(),
                        rs.getString("description"), rs.getString("category"),
                        rs.getDouble("amount")));
                }
            }
        }
        return list;
    }

    private void exec(String sql, long id) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id); ps.executeUpdate();
        }
    }

    // ══════════════════════════════════════════════
    //  QUICK SMOKE-TEST  (run as main for verify)
    // ══════════════════════════════════════════════
    public static void main(String[] args) throws Exception {
        // Update credentials to match your local PostgreSQL setup
        String url  = "jdbc:postgresql://localhost:5432/spendora";
        String user = "postgres";
        String pass = "postgres";

        try (SpendoraDB db = new SpendoraDB(url, user, pass)) {
            db.initSchema();

            // Register demo user
            long uid;
            User existing = db.findUserByEmail("demo@spendora.app");
            if (existing == null) {
                uid = db.registerUser("Demo User", "demo@spendora.app", "$2b$12$HASHED_PASSWORD_HERE");
                System.out.println("Registered user id=" + uid);
            } else {
                uid = existing.id();
                System.out.println("User already exists id=" + uid);
            }

            // Set budget
            db.setBudget(uid, 2026, 5, 50000);
            System.out.println("Budget: " + db.getBudget(uid, 2026, 5));

            // Add expenses
            long eid = db.addExpense(uid, LocalDate.now(), "Lunch", "🍔 Food", 350);
            System.out.println("Added expense id=" + eid);

            List<Expense> expenses = db.getExpenses(uid, LocalDate.now());
            expenses.forEach(e -> System.out.println("  Expense: " + e));

            // Category breakdown
            Map<String,Double> breakdown = db.getCategoryBreakdown(uid, 2026, 5);
            System.out.println("Category breakdown: " + breakdown);

            // Add subscription
            long sid = db.addSubscription(uid, 2026, 5, "Netflix", "🎬 Streaming", "Monthly", 15, 649, "Active");
            System.out.println("Added subscription id=" + sid);

            List<Subscription> subs = db.getSubscriptions(uid, 2026, 5);
            subs.forEach(s -> System.out.println("  Sub: " + s));

            System.out.println("\n✅  SpendoraDB smoke test passed.");
        }
    }
}
