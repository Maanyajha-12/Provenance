fn main() {
    std::env::set_var("PROTOC", protoc_bin_vendored::protoc_bin_path().unwrap());
    prost_build::compile_protos(&["proto/rewards.proto"], &["proto"]).unwrap();
    println!("cargo:rerun-if-changed=proto/rewards.proto");
}
