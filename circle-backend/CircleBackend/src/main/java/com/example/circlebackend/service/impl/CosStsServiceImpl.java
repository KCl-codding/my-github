package com.example.circlebackend.service.impl;

import com.example.circlebackend.service.CosStsService;
import com.example.circlebackend.vo.StsResponse;
import com.qcloud.cos.COSClient;
import com.qcloud.cos.ClientConfig;
import com.qcloud.cos.auth.BasicCOSCredentials;
import com.qcloud.cos.auth.COSCredentials;
import com.qcloud.cos.exception.CosClientException;
import com.qcloud.cos.exception.CosServiceException;
import com.qcloud.cos.model.DeleteObjectRequest;
import com.qcloud.cos.region.Region;
import com.tencent.cloud.CosStsClient;
import com.tencent.cloud.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URL;
import java.util.TreeMap;

@Service
public class CosStsServiceImpl implements CosStsService {

    private static final Logger logger = LoggerFactory.getLogger(CosStsServiceImpl.class);

    @Value("${tencent.cos.secret-id}")
    private String secretId;

    @Value("${tencent.cos.secret-key}")
    private String secretKey;

    @Value("${tencent.cos.region}")
    private String region;

    @Value("${tencent.cos.bucket}")
    private String bucket;

    @Override
    public StsResponse getStsCredential() throws Exception {
        TreeMap<String, Object> config = new TreeMap<>();
        config.put("secretId", secretId);
        config.put("secretKey", secretKey);
        config.put("durationSeconds", 1800);
        config.put("region", region);
        config.put("bucket", bucket);

        // 必需：允许的路径前缀，* 表示允许所有路径
        config.put("allowPrefix", "*");

        // 必需：允许的操作权限
        config.put("allowActions", new String[]{
                "name/cos:PutObject",      // 上传文件
                "name/cos:GetObject",      // 下载文件
                "name/cos:DeleteObject",   // 删除文件
                "name/cos:HeadObject"      // 获取文件元数据
        });

        Response response = CosStsClient.getCredential(config);
        logger.info("获取临时密钥成功");
        return StsResponse.success(response);
    }

    /**
     * 删除COS文件
     * @param fileUrl 文件URL或Key
     * @return 是否删除成功
     */
    @Override
    public boolean deleteFile(String fileUrl) {
        COSClient cosClient = null;
        try {
            // 1. 从URL中提取文件Key
            String key = extractKeyFromUrl(fileUrl);
            if (key == null || key.isEmpty()) {
                logger.error("无法从URL提取文件Key: {}", fileUrl);
                return false;
            }

            logger.info("准备删除文件，Key: {}", key);

            // 2. 创建COS客户端
            COSCredentials cred = new BasicCOSCredentials(secretId, secretKey);
            Region regionObj = new Region(region);
            ClientConfig clientConfig = new ClientConfig(regionObj);
            cosClient = new COSClient(cred, clientConfig);

            // 3. 执行删除
            DeleteObjectRequest deleteRequest = new DeleteObjectRequest(bucket, key);
            cosClient.deleteObject(deleteRequest);

            logger.info("文件删除成功: {}", key);
            return true;

        } catch (CosServiceException e) {
            logger.error("COS服务异常: {}", e.getErrorMessage());
            return false;
        } catch (CosClientException e) {
            logger.error("COS客户端异常: {}", e.getMessage());
            return false;
        } catch (Exception e) {
            logger.error("删除文件异常: {}", e.getMessage());
            return false;
        } finally {
            // 关闭客户端
            if (cosClient != null) {
                cosClient.shutdown();
            }
        }
    }

    /**
     * 从URL中提取COS文件的Key（路径）
     * 支持格式：
     * 1. https://bucket.cos.region.myqcloud.com/images/123.jpg
     * 2. https://bucket.cos.region.myqcloud.com/images/123.jpg?参数
     * 3. images/123.jpg (直接传Key)
     */
    private String extractKeyFromUrl(String fileUrl) {
        try {
            // 如果直接传的是Key（不包含://）
            if (!fileUrl.contains("://")) {
                return fileUrl;
            }

            // 解析URL
            URL url = new URL(fileUrl);
            String path = url.getPath();

            // 去掉开头的 /
            if (path.startsWith("/")) {
                path = path.substring(1);
            }

            return path;

        } catch (Exception e) {
            logger.error("解析URL失败: {}", e.getMessage());
            return null;
        }
    }
}