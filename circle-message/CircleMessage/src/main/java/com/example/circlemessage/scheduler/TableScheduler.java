package com.example.circlemessage.scheduler;

import com.example.circlemessage.service.db.MessageTableManager;
import com.example.circlemessage.utils.MessageTableUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 定时任务：自动检查并创建下个周期的消息表
 */
@Component
@EnableScheduling
public class TableScheduler {

    private static final Logger log = LoggerFactory.getLogger(TableScheduler.class);

    @Autowired
    private MessageTableManager tableManager;

    /**
     * 每天凌晨3点执行一次
     * 检查下个周期的表是否存在，不存在则创建
     */
    @Scheduled(cron = "0 0 3 * * ?")
    public void checkAndCreateNextTable() {
        log.info("⏰ 执行定时任务：检查消息表");

        String nextTableName = MessageTableUtil.getNextTableName();

        if (!tableManager.tableExists(nextTableName)) {
            log.info("📝 表 {} 不存在，开始创建...", nextTableName);
            tableManager.createNextTable();
        } else {
            log.info("✅ 表 {} 已存在，无需创建", nextTableName);
        }
    }

    /**
     * 每周一凌晨4点执行一次
     * 检查未来2年的表是否完整，不完整则补充创建
     */
    @Scheduled(cron = "0 0 4 * * MON")
    public void checkAndCreateFutureTables() {
        log.info("⏰ 执行周检查：确保未来2年的表都存在");

        // 获取应该存在的未来2年的表名
        java.util.List<String> expectedTables = MessageTableUtil.getFutureTableNames(2);

        int missingCount = 0;
        for (String tableName : expectedTables) {
            if (!tableManager.tableExists(tableName)) {
                log.info("📝 发现缺失表: {}", tableName);
                tableManager.createTable(tableName, getCommentFromTableName(tableName));
                missingCount++;
            }
        }

        if (missingCount == 0) {
            log.info("✅ 所有未来2年的表都已存在");
        } else {
            log.info("✅ 已补充创建 {} 张缺失的表", missingCount);
        }
    }

    /**
     * 从表名提取注释
     */
    private String getCommentFromTableName(String tableName) {
        try {
            int year = Integer.parseInt(tableName.substring(9, 13));
            int period = Integer.parseInt(tableName.substring(13, 15));
            return year + "年" + (period == 1 ? "1月-6月" : "7月-12月");
        } catch (Exception e) {
            return "消息表";
        }
    }
}