package com.example.circlemessage.service.db;

import com.example.circlemessage.utils.MessageTableUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

import java.util.List;

/**
 * 消息表管理服务
 * 负责自动创建消息表
 */
@Service
public class MessageTableManager {

    private static final Logger log = LoggerFactory.getLogger(MessageTableManager.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * 建表SQL模板
     */
    private static final String CREATE_TABLE_SQL = """
            CREATE TABLE IF NOT EXISTS `%s` (
                `id` BIGINT NOT NULL COMMENT '消息ID（雪花算法生成）',
                `session_id` VARCHAR(100) NOT NULL COMMENT '会话ID',
                `sender_openid` VARCHAR(64) NOT NULL COMMENT '发送者openid',
                `receiver_openid` VARCHAR(64) NOT NULL COMMENT '接收者openid',
                `message_type` TINYINT DEFAULT 1 COMMENT '1:文本 2:图片 3:文件',
                `content` TEXT COMMENT '消息内容',
                `file_url` VARCHAR(500) COMMENT '文件URL',
                `send_time` DATETIME NOT NULL COMMENT '发送时间',
                `is_read` BOOLEAN DEFAULT FALSE COMMENT '是否已读',
                `is_recalled` BOOLEAN DEFAULT FALSE COMMENT '是否撤回',
                `is_offline` BOOLEAN DEFAULT FALSE COMMENT '是否需要拉起',
                PRIMARY KEY (`id`),  -- 主键改为单列id
                KEY `idx_session_time` (`session_id`, `send_time`),
                KEY `idx_send_time` (`send_time`),  -- 用于分表查询
                KEY `idx_recall` (`is_recalled`, `send_time`)  -- 用于快速查找未撤回消息
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='消息表 - %s'
            """;

    /**
     * 创建单张表
     *
     * @param tableName 表名
     * @param comment   表注释
     */
    public void createTable(String tableName, String comment) {
        try {
            String sql = String.format(CREATE_TABLE_SQL, tableName, comment);
            jdbcTemplate.execute(sql);
            log.info("✅ 表创建成功: {}", tableName);
        } catch (Exception e) {
            log.error("❌ 表创建失败: {}, 错误: {}", tableName, e.getMessage());
        }
    }

    /**
     * 创建当前周期的表
     */
    public void createCurrentTable() {
        String tableName = MessageTableUtil.getCurrentTableName();
        String comment = getPeriodComment(LocalDateTime.now());
        createTable(tableName, comment);
    }

    /**
     * 创建下一个周期的表
     */
    public void createNextTable() {
        String tableName = MessageTableUtil.getNextTableName();

        // 计算下一个周期的描述
        LocalDateTime nextStart = getNextPeriodStart();
        String comment = getPeriodComment(nextStart);

        createTable(tableName, comment);
    }

    /**
     * 批量创建未来N年的所有表
     *
     * @param years 未来几年（默认2年）
     */
    public void createFutureTables(int years) {
        List<String> tableNames = MessageTableUtil.getFutureTableNames(years);

        log.info("📝 开始创建未来{}年的消息表，共{}张", years, tableNames.size());

        for (String tableName : tableNames) {
            // 提取年份和周期用于注释
            int year = Integer.parseInt(tableName.substring(9, 13));
            int period = Integer.parseInt(tableName.substring(13, 15));
            String comment = year + "年" + (period == 1 ? "1月-6月" : "7月-12月");

            createTable(tableName, comment);
        }

        log.info("✅ 批量建表完成");
    }

    /**
     * 检查表是否存在
     */
    public boolean tableExists(String tableName) {
        String sql = """
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = DATABASE() AND table_name = ?
                """;
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, tableName);
        return count != null && count > 0;
    }

    /**
     * 获取所有消息表（用于维护）
     */
    public List<String> getAllMessageTables() {
        String sql = """
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = DATABASE() AND table_name LIKE 'messages_%'
                ORDER BY table_name
                """;
        return jdbcTemplate.queryForList(sql, String.class);
    }

    /**
     * 删除指定表（慎用，仅用于测试）
     */
    public void dropTable(String tableName) {
        try {
            jdbcTemplate.execute("DROP TABLE IF EXISTS " + tableName);
            log.info("🗑️ 表已删除: {}", tableName);
        } catch (Exception e) {
            log.error("删除表失败: {}", e.getMessage());
        }
    }

    /**
     * 获取周期描述
     */
    private String getPeriodComment(LocalDateTime time) {
        int year = time.getYear();
        if (time.getMonthValue() <= 6) {
            return year + "年1月-6月";
        } else {
            return year + "年7月-12月";
        }
    }

    /**
     * 获取下一个周期开始时间
     */
    private LocalDateTime getNextPeriodStart() {
        LocalDateTime now = LocalDateTime.now();
        if (now.getMonthValue() <= 6) {
            return LocalDateTime.of(now.getYear(), 7, 1, 0, 0);
        } else {
            return LocalDateTime.of(now.getYear() + 1, 1, 1, 0, 0);
        }
    }
}