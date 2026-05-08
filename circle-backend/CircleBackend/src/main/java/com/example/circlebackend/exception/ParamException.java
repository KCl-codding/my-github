package com.example.circlebackend.exception;

public class ParamException extends BusinessException {
    public ParamException(ResultCode resultCode) {
        super(resultCode.getCode(), resultCode.getMessage());
    }

    public ParamException(ResultCode resultCode, String extraMessage) {
        super(resultCode.getCode(), resultCode.getMessage() + ": " + extraMessage);
    }
}