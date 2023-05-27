
// = 009 ======================================================================
// これまでのサンプルでは、メッシュは「１つのジオメトリから１つ」ずつ生成してい
// ましたが、実際の案件では、同じジオメトリを再利用しながら「複数のメッシュ」を
// 生成する場面のほうが多いかもしれません。
// このとき、3D シーンに複数のオブジェクトを追加する際にやってしまいがちな間違い
// として「ジオメトリやマテリアルも複数回生成してしまう」というものがあります。
// メモリ効率よく複数のオブジェクトをシーンに追加する方法をしっかりおさえておき
// ましょう。
// ============================================================================

// 必要なモジュールを読み込み
//import * as THREE from '../lib/three.min.js';
import * as THREE from '../lib/three.module.js';
import { DragControls } from '../lib/DragControls.js';
import { OrbitControls } from '../lib/OrbitControls.js';

let BOX_COUNT_X = 0; // 一行の数
let BOX_COUNT_Y = 0; // 一列の数
let ASPECT = window.innerWidth / window.innerHeight;

// DOM がパースされたことを検出するイベントを設定
window.addEventListener('DOMContentLoaded', () => {
  // 制御クラスのインスタンスを生成
  const app = new App3();
  // 初期化
  app.init();
  // 描画
  app.render();
}, false);

/**
 * three.js を効率よく扱うために自家製の制御クラスを定義
 */
class App3 {
  /**
   * カメラ定義のための定数
   */
  static get CAMERA_PARAM() {
    return {
      // fovy は Field of View Y のことで、縦方向の視野角を意味する
      fovy: 60,
      // 描画する空間のアスペクト比（縦横比）
      aspect: ASPECT,
      // 描画する空間のニアクリップ面（最近面）
      near: 0.1,
      // 描画する空間のファークリップ面（最遠面）
      far: 100.0,
      // カメラの位置
      x: 0.0,
      y: -2.0,
      z: 5.0,
      // カメラの中止点
      lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
    };
  }
  /**
   * レンダラー定義のための定数
   */
  static get RENDERER_PARAM() {
    return {
      // レンダラーが背景をリセットする際に使われる背景色
      clearColor: 0x666666,
      // レンダラーが描画する領域の横幅
      width: window.innerWidth,
      // レンダラーが描画する領域の縦幅
      height: window.innerHeight,
    };
  }
  /**
   * ディレクショナルライト定義のための定数
   */
  static get DIRECTIONAL_LIGHT_PARAM() {
    return {
      color: 0xffffff, // 光の色
      intensity: 1.0,  // 光の強度
      x: 1.0,          // 光の向きを表すベクトルの X 要素
      y: 1.0,          // 光の向きを表すベクトルの Y 要素
      z: 1.0           // 光の向きを表すベクトルの Z 要素
    };
  }
  /**
   * アンビエントライト定義のための定数
   */
  static get AMBIENT_LIGHT_PARAM() {
    return {
      color: 0xffffff, // 光の色
      intensity: 0.2,  // 光の強度
    };
  }
  /**
   * マテリアル定義のための定数
   */
  static get MATERIAL_PARAM() {
    return {
      //color: 0x3399ff, // マテリアルの基本色
      color: 0xffffff
    };
  }

  /**
   * コンストラクタ
   * @constructor
   */
  constructor() {
    this.renderer;         // レンダラ
    this.scene;            // シーン
    this.camera;           // カメラ
    this.directionalLight; // ディレクショナルライト
    this.ambientLight;     // アンビエントライト
    this.material;         // マテリアル
    this.boxGeometry;    // トーラスジオメトリ
    this.boxArray;       // トーラスメッシュの配列 @@@
    this.controls;         // オービットコントロール
    this.axesHelper;       // 軸ヘルパー
    this.pointer;
    this.raycaster;
    this.isDown = false; // キーの押下状態を保持するフラグ

    // 再帰呼び出しのための this 固定
    this.render = this.render.bind(this);

    // リサイズイベント
    window.addEventListener('resize', () => {
      let ASPECT = window.innerWidth / window.innerHeight;
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }, false);
  }

  /**
   * 初期化処理
   */
  init() {
    // レンダラー
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor(new THREE.Color(App3.RENDERER_PARAM.clearColor));
    this.renderer.setSize(App3.RENDERER_PARAM.width, App3.RENDERER_PARAM.height);
    const wrapper = document.querySelector('#webgl');
    wrapper.appendChild(this.renderer.domElement);
    
    // RayCater
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();

    // シーン
    this.scene = new THREE.Scene();

    // カメラ
    this.camera = new THREE.PerspectiveCamera(
      App3.CAMERA_PARAM.fovy,
      App3.CAMERA_PARAM.aspect,
      App3.CAMERA_PARAM.near,
      App3.CAMERA_PARAM.far,
    );
    this.camera.position.set(
      App3.CAMERA_PARAM.x,
      App3.CAMERA_PARAM.y,
      App3.CAMERA_PARAM.z,
    );
    this.camera.lookAt(App3.CAMERA_PARAM.lookAt);

    // マウスイベントを登録
    wrapper.addEventListener('mousemove', (event) => {
      const element = event.currentTarget;
      // canvas要素上のXY座標
      const x = event.clientX - element.offsetLeft;
      const y = event.clientY - element.offsetTop;
      // canvas要素の幅・高さ
      const w = element.offsetWidth;
      const h = element.offsetHeight;

      // -1〜+1の範囲で現在のマウス座標を登録する
      this.pointer.x = ( x / w ) * 2 - 1;
      this.pointer.y = -( y / h ) * 2 + 1;
    });

    // ディレクショナルライト（平行光源）
    this.directionalLight = new THREE.DirectionalLight(
      App3.DIRECTIONAL_LIGHT_PARAM.color,
      App3.DIRECTIONAL_LIGHT_PARAM.intensity
    );
    this.directionalLight.position.set(
      App3.DIRECTIONAL_LIGHT_PARAM.x,
      App3.DIRECTIONAL_LIGHT_PARAM.y,
      App3.DIRECTIONAL_LIGHT_PARAM.z,
    );
    this.scene.add(this.directionalLight);

    // アンビエントライト（環境光）
    this.ambientLight = new THREE.AmbientLight(
      App3.AMBIENT_LIGHT_PARAM.color,
      App3.AMBIENT_LIGHT_PARAM.intensity,
    );
    this.scene.add(this.ambientLight);

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // マテリアル
    //this.material = new THREE.MeshStandardMaterial(App3.MATERIAL_PARAM);

    // 共通のジオメトリ、マテリアルから、複数のメッシュインスタンスを作成する @@@
    BOX_COUNT_X = 30; // 一列の数
    BOX_COUNT_Y = Math.ceil(BOX_COUNT_X / ASPECT);
    let BOX_COUNT = BOX_COUNT_X * BOX_COUNT_Y;
    const BOX_SIZE = (12 / BOX_COUNT_X);// 一個当たりのサイズは（横幅／BOX_COUNT）
    const BOX_MARGIN = 1.25;
    let BOX_LEFT = 0 + ((BOX_SIZE * (BOX_MARGIN - 1)) / 2) + (BOX_SIZE / 2) - ((BOX_SIZE * BOX_MARGIN) * (BOX_COUNT_X / 2));
    let BOX_TOP = 0 - ((BOX_LEFT / ASPECT)) + ((BOX_SIZE * (BOX_MARGIN - 1)) / 2);
    let TURN_COUNT = 0;
    const TRANSFORM_SCALE = 5.0;
    this.boxGeometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
    
    this.boxArray = [];
    for (let i = 0; i < BOX_COUNT; ++i) {
      // メッシュのインスタンスを生成
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const box = new THREE.Mesh(this.boxGeometry, material);

      box.userData.id = i;

      // 画面の横幅いっぱいに並べる
      box.position.x = BOX_LEFT + ((i - (BOX_COUNT_X * TURN_COUNT)) * (BOX_SIZE * BOX_MARGIN));

      // 上に並べる
      box.position.y = BOX_TOP - (BOX_SIZE * BOX_MARGIN * TURN_COUNT);

      // 折り返し
      if(i != 0 && (i+1) % BOX_COUNT_X === 0){
        TURN_COUNT ++;
      }

      box.rotation.y = Math.random()*0.5;

      // シーンに追加する
      this.scene.add(box);

      // 配列に入れておく
      this.boxArray.push(box);      
    }

    // ヘルパー
    //const axesBarLength = 5.0;
    //this.axesHelper = new THREE.AxesHelper(axesBarLength);
    //this.scene.add(this.axesHelper);
  }

  /**
   * 描画処理
   */
  render() {


    // コントロールを更新
    //this.controls.update();

    this.boxArray.forEach((box) => {
      box.rotation.y += 0.0125;
    });
    
    //レイキャスト
    this.raycaster.setFromCamera( this.pointer, this.camera );

    // その光線とぶつかったオブジェクトを得る
    const intersects = this.raycaster.intersectObjects(this.boxArray);

    for(var i = 0; i < this.boxArray.length; i++){
      this.boxArray[i].material.color.setHex(0x29ABE2);
    }

    this.boxArray.forEach((box) => {
      // 交差しているオブジェクトが1つ以上存在ていたら
       if (intersects.length > 0 && box === intersects[0].object) {

        let center = box.userData.id;

        // 色を変える
        let centerArray = [ 0 ];

        // 縦列
        let firstLine = Math.floor(center % BOX_COUNT_X);
        
        for(var i = 0; i < BOX_COUNT_Y; i++){
          let thisId = (firstLine - 1) + (BOX_COUNT_X * i);
          centerArray.push(thisId);
        }
        for(var i = 0; i < BOX_COUNT_Y; i++){
          let thisId = firstLine + (BOX_COUNT_X * i);
          centerArray.push(thisId);
        }
        for(var i = 0; i < BOX_COUNT_Y; i++){
          let thisId = (firstLine + 1) + (BOX_COUNT_X * i);
          centerArray.push(thisId);
        }
        for(var i = 0; i < centerArray.length; i++){
          let id = centerArray[i];
          if(id > 0 && id < this.boxArray.length){
            this.boxArray[id].material.color.setHex(0x00FFFF);
          }
        }
        this.boxArray[center].rotation.y += 0.125;
        this.boxArray[center].material.color.setHex(0xffffff);
      } else {
        // それ以外は元の色にする
        //box.material.color.setHex(0xffffff);
      }
    });

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
    
    // 恒常ループの設定
    requestAnimationFrame(this.render);
  }
}

