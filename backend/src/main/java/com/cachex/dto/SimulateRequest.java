package com.cachex.dto;

import java.util.List;

public class SimulateRequest {
    private String patternName; // "hotspot", "cyclic", "scan", "zipfian", "custom"
    private List<String> customSequence;
    private int stepDelayMs;

    public SimulateRequest() {}

    public String getPatternName() { return patternName; }
    public void setPatternName(String patternName) { this.patternName = patternName; }

    public List<String> getCustomSequence() { return customSequence; }
    public void setCustomSequence(List<String> customSequence) { this.customSequence = customSequence; }

    public int getStepDelayMs() { return stepDelayMs; }
    public void setStepDelayMs(int stepDelayMs) { this.stepDelayMs = stepDelayMs; }
}
