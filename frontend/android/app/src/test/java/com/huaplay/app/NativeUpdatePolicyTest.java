package com.huaplay.app;

import org.junit.Test;

import static org.junit.Assert.*;

public class NativeUpdatePolicyTest {

    @Test
    public void testValidDownloadUrl() {
        assertTrue(NativeUpdatePolicy.isValidDownloadUrl("https://huaplay.playdb.info/downloads/huaplay/HuaPlay-1.0.3.apk"));
        assertTrue(NativeUpdatePolicy.isValidDownloadUrl("https://huaplay.playdb.info:443/downloads/huaplay/app_v4.apk"));
        assertEquals("HuaPlay-1.0.3.apk", NativeUpdatePolicy.extractApkFilename("https://huaplay.playdb.info/downloads/huaplay/HuaPlay-1.0.3.apk"));
    }

    @Test
    public void testInvalidDownloadUrls() {
        // HTTP instead of HTTPS
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl("http://huaplay.playdb.info/downloads/huaplay/app.apk"));
        // Wrong host
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl("https://malicious.com/downloads/huaplay/app.apk"));
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl("https://huaplay.playdb.info.evil.com/downloads/huaplay/app.apk"));
        // Credentials / user info
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl("https://user:pass@huaplay.playdb.info/downloads/huaplay/app.apk"));
        // Custom non-standard port
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl("https://huaplay.playdb.info:8443/downloads/huaplay/app.apk"));
        // Fragment
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl("https://huaplay.playdb.info/downloads/huaplay/app.apk#hash"));
        // Path traversal
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl("https://huaplay.playdb.info/downloads/huaplay/../app.apk"));
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl("https://huaplay.playdb.info/downloads/huaplay/sub/app.apk"));
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl("https://huaplay.playdb.info/other/app.apk"));
        // Invalid extension
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl("https://huaplay.playdb.info/downloads/huaplay/app.zip"));
        // Null or empty
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl(null));
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl(""));
        assertFalse(NativeUpdatePolicy.isValidDownloadUrl("   "));
    }

    @Test
    public void testSha256Validation() {
        String validHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        assertTrue(NativeUpdatePolicy.isValidSha256(validHash));
        assertTrue(NativeUpdatePolicy.isValidSha256(validHash.toUpperCase()));
        assertEquals(validHash, NativeUpdatePolicy.normalizeSha256(validHash.toUpperCase()));

        // Too short
        assertFalse(NativeUpdatePolicy.isValidSha256("e3b0c442"));
        // Too long
        assertFalse(NativeUpdatePolicy.isValidSha256(validHash + "aa"));
        // Non-hex
        assertFalse(NativeUpdatePolicy.isValidSha256("g" + validHash.substring(1)));
        // Null
        assertFalse(NativeUpdatePolicy.isValidSha256(null));
    }

    @Test
    public void testVersionCodeValidation() {
        assertTrue(NativeUpdatePolicy.isValidVersionCode(4, 3));
        assertFalse(NativeUpdatePolicy.isValidVersionCode(3, 3)); // not greater
        assertFalse(NativeUpdatePolicy.isValidVersionCode(2, 3)); // lower
        assertFalse(NativeUpdatePolicy.isValidVersionCode(0, 0)); // zero
        assertFalse(NativeUpdatePolicy.isValidVersionCode(-1, 0)); // negative
        assertFalse(NativeUpdatePolicy.isValidVersionCode(((long) Integer.MAX_VALUE) + 1L, 3)); // exceeds int max
        assertTrue(NativeUpdatePolicy.isValidVersionCode(Integer.MAX_VALUE, 3));
    }

    @Test
    public void testContentLengthValidation() {
        assertTrue(NativeUpdatePolicy.isContentLengthAcceptable(-1));
        assertTrue(NativeUpdatePolicy.isContentLengthAcceptable(1024));
        assertTrue(NativeUpdatePolicy.isContentLengthAcceptable(64L * 1024L * 1024L));
        assertFalse(NativeUpdatePolicy.isContentLengthAcceptable(64L * 1024L * 1024L + 1L));
    }

    @Test
    public void testRedirectDetection() {
        assertTrue(NativeUpdatePolicy.isRedirect(301));
        assertTrue(NativeUpdatePolicy.isRedirect(302));
        assertTrue(NativeUpdatePolicy.isRedirect(303));
        assertTrue(NativeUpdatePolicy.isRedirect(307));
        assertTrue(NativeUpdatePolicy.isRedirect(308));
        assertFalse(NativeUpdatePolicy.isRedirect(200));
        assertFalse(NativeUpdatePolicy.isRedirect(404));
    }

    @Test
    public void testBytesToHexAndHashMatch() {
        byte[] sample = new byte[] { (byte) 0xde, (byte) 0xad, (byte) 0xbe, (byte) 0xef };
        assertEquals("deadbeef", NativeUpdatePolicy.bytesToHex(sample));
        assertTrue(NativeUpdatePolicy.hashesMatch("DEADBEEF", "deadbeef"));
        assertFalse(NativeUpdatePolicy.hashesMatch("deadbeef", "cafebabe"));
        assertFalse(NativeUpdatePolicy.hashesMatch(null, "deadbeef"));
    }

    @Test
    public void testComputeFileSha256() throws Exception {
        java.io.File tempFile = java.io.File.createTempFile("test_hash_", ".tmp");
        try {
            java.nio.file.Files.write(tempFile.toPath(), "test content".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            String hash = NativeUpdatePolicy.computeFileSha256(tempFile);
            assertNotNull(hash);
            assertEquals(64, hash.length());
            assertTrue(NativeUpdatePolicy.isValidSha256(hash));
            // Exact SHA-256 for UTF-8 "test content" confirmed via crypto: 6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72
            assertEquals("6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72", hash);
        } finally {
            tempFile.delete();
        }
    }
}
