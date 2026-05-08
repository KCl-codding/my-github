package com.example.circlebackend.vo;

import com.tencent.cloud.Response;

public class StsResponse {
    private int code;
    private String message;
    private StsData data;

    public static StsResponse success(Response response) {
        StsResponse res = new StsResponse();
        res.code = 200;
        res.message = "success";
        StsData data = new StsData();
        data.setTmpSecretId(response.credentials.tmpSecretId);
        data.setTmpSecretKey(response.credentials.tmpSecretKey);
        data.setSessionToken(response.credentials.sessionToken);
        data.setStartTime(response.startTime);
        data.setExpiredTime(response.expiredTime);
        res.data = data;
        return res;
    }

    public static StsResponse error(String msg) {
        StsResponse res = new StsResponse();
        res.code = 500;
        res.message = msg;
        return res;
    }

    // getter/setter
    public int getCode() { return code; }
    public void setCode(int code) { this.code = code; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public StsData getData() { return data; }
    public void setData(StsData data) { this.data = data; }
}