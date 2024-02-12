#!/usr/bin/env bb

;; Use this script to install local versions of minauth and its plugins
;; for easy development and testing.

(require '[babashka.fs :as fs])

(def copied-dep-files ["dist" "package.json" "README.MD" "LICENSE"])

(def packages [{:name "minauth-simple-preimage-plugin" :path "/home/anks/spre" :deps [:mlib]}
               {:name "minauth-erc721-timelock-plugin" :path "/home/anks/etl" :deps [:mlib]}
               {:name "minauth-merkle-membership-plugin" :path "/home/anks/mm" :deps [:mlib]}
               {:name "minauth-demo-server" :path "/home/anks/serv" :deps [:spre :mlib :mm :etl]}
               {:name "minauth-demo-client" :path "/home/anks/client" :deps [:spre :mlib :mm :etl]}])

(def global-deps {:spre {:name "minauth-simple-preimage-plugin" :path "/home/anks/spre"}
                 :etl {:name "minauth-erc721-timelock-plugin" :path "/home/anks/etl"}
                 :mlib {:name "minauth" :path "/home/anks/mlib"}
                 :mm {:name "minauth-merkle-membership-plugin" :path "/home/anks/mm"}})

(defn- logret [msg]
  (println msg)
  msg)

(defn- copy-over [src dst]
  (when (fs/exists? src)
    (if (fs/directory? src)
      (let [dest-dir (str dst "/" (fs/file-name src))]
        (fs/create-dirs dest-dir)
        (println "Copying directory:" src "to:" dest-dir)
        (fs/copy-tree src dest-dir))
      (do
        (println "Copying file:" src "to:" dst)
        (fs/copy src dst)))))

(defn- setup-dependency-dir [dep-name working-dir]
  (let [dep-path (str working-dir "/node_modules/" dep-name)]
    (when (fs/exists? dep-path)
      (fs/delete-tree dep-path))
    (fs/create-dirs dep-path)
    dep-path))

(defn- process-dependency [dep-key working-dir]
  (let [dep (global-deps dep-key)
        dep-name (:name dep)
        dep-src-path (:path dep)
        dep-dest-path (setup-dependency-dir dep-name working-dir)]
    (println "Installing dependency:" dep-name)
    (doseq [file copied-dep-files]
      (copy-over (str dep-src-path "/" file) dep-dest-path))))

(defn- process-package [package dep-filter]
  (let [package-path (:path package)
        package-deps (if dep-filter
                       (filter #(= % dep-filter) (:deps package))
                       (:deps package))]
    (when (seq package-deps)
      (println "Processing package:" (:name package))
      (doseq [dep-key package-deps]
        (process-dependency dep-key package-path)))))

(defn- package-separator [process-package-fn]
  (println "===============================")
  (process-package-fn)
  (println "==============================="))

(defn -main [& args]
  (let [dep-filter (when (some #(= % "--dep") args)
                     (second (split-with #(not= % "--dep") args)))]
    (println "Starting script...")
    (doseq [package packages]
      (package-separator #(process-package package dep-filter)))
    (println "Script completed.")))

;; Call the main function
(-main)
